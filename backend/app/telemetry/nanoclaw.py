"""Telemetry source that streams live events from a local Nanoclaw host."""

from __future__ import annotations

import asyncio
import json
import sqlite3
from collections import OrderedDict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import AsyncIterator, Dict, Iterable, List, Optional
from uuid import uuid4

from ..config import Settings
from ..logging import get_logger
from .models import AgentState, EventPayload, EventType, TelemetryEvent
from .source import TelemetrySource


log = get_logger(__name__)


@dataclass
class AgentGroup:
    id: str
    name: str


@dataclass
class SessionRecord:
    id: str
    agent_group_id: str
    path: Path


@dataclass
class InboundRecord:
    message_id: str
    agent_group_id: str
    source_agent_id: Optional[str]
    channel_type: Optional[str]
    summary: str


class SessionWatcher:
    """Tails a session's inbound/outbound message databases."""

    def __init__(self, session_id: str, agent_group_id: str, session_path: Path, history_events: int) -> None:
        self.session_id = session_id
        self.agent_group_id = agent_group_id
        self.session_path = session_path
        self.history_events = history_events
        self.inbound_path = session_path / "inbound.db"
        self.outbound_path = session_path / "outbound.db"
        self.last_in_seq = self._prime_seq(self.inbound_path, "messages_in")
        self.last_out_seq = self._prime_seq(self.outbound_path, "messages_out")

    def fetch_inbound(self) -> List[sqlite3.Row]:
        return self._fetch_rows(self.inbound_path, "messages_in", "last_in_seq")

    def fetch_outbound(self) -> List[sqlite3.Row]:
        return self._fetch_rows(self.outbound_path, "messages_out", "last_out_seq")

    def _fetch_rows(self, db_path: Path, table: str, seq_attr: str) -> List[sqlite3.Row]:
        if not db_path.exists():
            return []
        rows: List[sqlite3.Row] = []
        try:
            conn = sqlite3.connect(db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.execute(f"SELECT * FROM {table} WHERE seq > ? ORDER BY seq", (getattr(self, seq_attr),))
            rows = cursor.fetchall()
            if rows:
                setattr(self, seq_attr, rows[-1]["seq"])
            conn.close()
        except sqlite3.DatabaseError as exc:
            log.warning("nanoclaw_session_read_failed", session=self.session_id, error=str(exc))
        return rows

    def _prime_seq(self, db_path: Path, table: str) -> int:
        if not db_path.exists():
            return 0
        try:
            conn = sqlite3.connect(db_path)
            conn.row_factory = sqlite3.Row
            row = conn.execute(f"SELECT seq FROM {table} ORDER BY seq DESC LIMIT 1").fetchone()
            if not row:
                conn.close()
                return 0
            if self.history_events <= 0:
                conn.close()
                return row["seq"]
            history_row = conn.execute(
                f"SELECT seq FROM {table} ORDER BY seq DESC LIMIT 1 OFFSET ?",
                (self.history_events,),
            ).fetchone()
            conn.close()
            return history_row["seq"] if history_row else row["seq"]
        except sqlite3.DatabaseError:
            return 0


class NanoclawTelemetrySource(TelemetrySource):
    """Streams real Nanoclaw events by tailing session SQLite databases."""

    def __init__(self, config: Settings) -> None:
        self.root = config.root_path
        self.data_root = self.root / "data"
        self.sessions_root = self.data_root / "v2-sessions"
        self.central_db = self.data_root / "v2.db"
        self.poll_interval = max(0.1, config.poll_interval_ms / 1000)
        self.history_events = config.history_events
        self.orchestrator_hint = config.orchestrator_group.lower() if config.orchestrator_group else None
        self._agent_groups: Dict[str, AgentGroup] = {}
        self._sessions: Dict[str, SessionWatcher] = {}
        self._session_map: Dict[str, SessionRecord] = {}
        self._inbound_cache: "OrderedDict[str, InboundRecord]" = OrderedDict()
        self._cache_size = 5000
        self._orchestrator_id: Optional[str] = None

        if not self.central_db.exists():
            raise FileNotFoundError(f"Nanoclaw database not found at {self.central_db}")
        self._refresh_agent_groups()
        self._refresh_sessions()

    async def stream(self) -> AsyncIterator[TelemetryEvent]:
        while True:
            events = []
            try:
                self._refresh_agent_groups()
                self._refresh_sessions()
                events = self._collect_events()
            except Exception as exc:  # noqa: BLE001
                log.warning("nanoclaw_stream_error", error=str(exc))
            for event in events:
                yield event
            await asyncio.sleep(self.poll_interval)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _collect_events(self) -> List[TelemetryEvent]:
        events: List[TelemetryEvent] = []
        for session_id, watcher in list(self._sessions.items()):
            inbound_rows = watcher.fetch_inbound()
            for row in inbound_rows:
                event = self._build_question_event(watcher, row)
                if event:
                    events.append(event)
            outbound_rows = watcher.fetch_outbound()
            for row in outbound_rows:
                event = self._build_response_event(watcher, row)
                if event:
                    events.append(event)
        return events

    def _refresh_agent_groups(self) -> None:
        rows = self._query(self.central_db, "SELECT id, name FROM agent_groups")
        groups = {row["id"]: AgentGroup(id=row["id"], name=row["name"] or row["id"]) for row in rows}
        if groups:
            self._agent_groups = groups
            self._orchestrator_id = self._determine_orchestrator()

    def _refresh_sessions(self) -> None:
        rows = self._query(self.central_db, "SELECT id, agent_group_id FROM sessions")
        latest_sessions: Dict[str, SessionRecord] = {}
        for row in rows:
            session_id = row["id"]
            agent_group = row["agent_group_id"]
            session_path = self.sessions_root / agent_group / session_id
            if session_path.exists():
                latest_sessions[session_id] = SessionRecord(
                    id=session_id,
                    agent_group_id=agent_group,
                    path=session_path,
                )

        # Remove stale watchers
        for session_id in list(self._sessions.keys()):
            if session_id not in latest_sessions:
                self._sessions.pop(session_id, None)

        # Add new watchers
        for session_id, record in latest_sessions.items():
            if session_id not in self._sessions:
                self._sessions[session_id] = SessionWatcher(
                    session_id=session_id,
                    agent_group_id=record.agent_group_id,
                    session_path=record.path,
                    history_events=self.history_events,
                )

        self._session_map = latest_sessions

    # ------------------------------------------------------------------
    # Event builders
    # ------------------------------------------------------------------

    def _build_question_event(self, watcher: SessionWatcher, row: sqlite3.Row) -> Optional[TelemetryEvent]:
        source_agent_id = None
        source_label = "User"
        source = None
        source_session_id = row.get("source_session_id")
        if source_session_id:
            source_record = self._session_map.get(source_session_id)
            if source_record:
                source_agent_id = source_record.agent_group_id
        if source_agent_id:
            source = f"agent:{source_agent_id}"
            source_label = self._agent_label(source_agent_id)
        else:
            channel = row.get("channel_type") or "user"
            source = f"channel:{channel}"
            source_label = channel.title()

        target_agent = f"agent:{watcher.agent_group_id}"
        meta = {
            "sourceLabel": source_label,
            "targetLabel": self._agent_label(watcher.agent_group_id),
        }
        orchestrator_node = self._orchestrator_node()
        if orchestrator_node:
            meta["orchestratorId"] = orchestrator_node

        summary = self._summarize(row.get("content"))
        event = TelemetryEvent(
            id=str(uuid4()),
            timestamp=row.get("timestamp") or self._now(),
            type=EventType.QUESTION,
            source=source,
            target=target_agent,
            payload=EventPayload(summary=summary, status="running", duration_ms=None, meta=meta),
            agent_state=AgentState.RUNNING,
        )

        self._remember_inbound(
            InboundRecord(
                message_id=row["id"],
                agent_group_id=watcher.agent_group_id,
                source_agent_id=source_agent_id,
                channel_type=row.get("channel_type"),
                summary=summary,
            )
        )

        return event

    def _build_response_event(self, watcher: SessionWatcher, row: sqlite3.Row) -> Optional[TelemetryEvent]:
        source = f"agent:{watcher.agent_group_id}"
        source_label = self._agent_label(watcher.agent_group_id)
        target_label = None
        target = None

        if channel := row.get("channel_type"):
            target = f"channel:{channel}"
            target_label = channel.title()
        elif reply_id := row.get("in_reply_to"):
            cached = self._inbound_cache.get(reply_id)
            if cached:
                if cached.source_agent_id:
                    target = f"agent:{cached.source_agent_id}"
                    target_label = self._agent_label(cached.source_agent_id)
                elif cached.channel_type:
                    target = f"channel:{cached.channel_type}"
                    target_label = cached.channel_type.title()

        if not target:
            # Fallback to orchestrator if configured, else echo back to self
            fallback_agent = self._orchestrator_id or watcher.agent_group_id
            target = f"agent:{fallback_agent}"
            target_label = self._agent_label(fallback_agent)

        meta = {
            "sourceLabel": source_label,
            "targetLabel": target_label,
        }
        orchestrator_node = self._orchestrator_node()
        if orchestrator_node:
            meta["orchestratorId"] = orchestrator_node

        duration_ms = None
        payload = EventPayload(
            summary=self._summarize(row.get("content")),
            duration_ms=duration_ms,
            status="completed",
            meta=meta,
        )

        return TelemetryEvent(
            id=str(uuid4()),
            timestamp=row.get("timestamp") or self._now(),
            type=EventType.RESPONSE,
            source=source,
            target=target,
            payload=payload,
            agent_state=AgentState.RUNNING,
        )

    # ------------------------------------------------------------------
    # Utility helpers
    # ------------------------------------------------------------------

    def _agent_label(self, agent_group_id: str) -> str:
        group = self._agent_groups.get(agent_group_id)
        return group.name if group else agent_group_id

    def _remember_inbound(self, record: InboundRecord) -> None:
        self._inbound_cache[record.message_id] = record
        self._inbound_cache.move_to_end(record.message_id)
        if len(self._inbound_cache) > self._cache_size:
            self._inbound_cache.popitem(last=False)

    def _determine_orchestrator(self) -> Optional[str]:
        if not self._agent_groups:
            return None
        if self.orchestrator_hint:
            for group in self._agent_groups.values():
                if group.id == self.orchestrator_hint or group.name.lower() == self.orchestrator_hint:
                    return group.id
        for group in self._agent_groups.values():
            if "orchestrator" in group.name.lower():
                return group.id
        # fallback to first group for deterministic layout
        return next(iter(self._agent_groups.keys()), None)

    def _orchestrator_node(self) -> Optional[str]:
        if not self._orchestrator_id:
            return None
        return f"agent:{self._orchestrator_id}"

    def _query(self, db_path: Path, sql: str) -> Iterable[sqlite3.Row]:
        try:
            conn = sqlite3.connect(db_path)
            conn.row_factory = sqlite3.Row
            rows = conn.execute(sql).fetchall()
            conn.close()
            return rows
        except sqlite3.DatabaseError as exc:
            log.warning("nanoclaw_query_failed", sql=sql, error=str(exc))
            return []

    def _summarize(self, raw: Optional[str]) -> str:
        if not raw:
            return "(empty)"
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            return raw.strip()[:240]

        if isinstance(data, dict):
            for key in ("text", "content", "prompt", "message", "body"):
                value = data.get(key)
                if isinstance(value, str) and value.strip():
                    return value.strip()[:240]
            if "messages" in data and isinstance(data["messages"], list):
                for item in data["messages"]:
                    if isinstance(item, dict):
                        text = item.get("text") or item.get("content")
                        if isinstance(text, str) and text.strip():
                            return text.strip()[:240]
        if isinstance(data, list):
            parts = []
            for item in data:
                if isinstance(item, str):
                    parts.append(item)
                elif isinstance(item, dict):
                    text = item.get("text") or item.get("content")
                    if isinstance(text, str):
                        parts.append(text)
            if parts:
                return " ".join(parts)[:240]
        return json.dumps(data, ensure_ascii=False)[:240]

    def _now(self) -> str:
        return datetime.now(timezone.utc).isoformat()
