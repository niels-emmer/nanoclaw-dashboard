"""Telemetry source that streams live events from a local Nanoclaw host."""

from __future__ import annotations

import asyncio
import json
import sqlite3
import time
from collections import OrderedDict
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, AsyncIterator, Dict, Iterable, List, Optional
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
class AgentConfig:
    """Cached container_configs data for an agent group."""
    provider: Optional[str] = None
    model: Optional[str] = None
    effort: Optional[str] = None
    skills: Optional[List[str]] = None
    assistant_name: Optional[str] = None


@dataclass
class SessionRecord:
    id: str
    agent_group_id: str
    path: Path
    container_status: Optional[str] = None
    last_active: Optional[str] = None


@dataclass
class InboundRecord:
    message_id: str
    agent_group_id: str
    source_agent_id: Optional[str]
    channel_type: Optional[str]
    summary: str


class SessionWatcher:
    """Tails a session's inbound/outbound message databases and operational tables."""

    def __init__(self, session_id: str, agent_group_id: str, session_path: Path, history_events: int) -> None:
        self.session_id = session_id
        self.agent_group_id = agent_group_id
        self.session_path = session_path
        self.history_events = history_events
        self.inbound_path = session_path / "inbound.db"
        self.outbound_path = session_path / "outbound.db"
        self.heartbeat_path = session_path / ".heartbeat"
        self.last_in_seq = self._prime_seq(self.inbound_path, "messages_in")
        self.last_out_seq = self._prime_seq(self.outbound_path, "messages_out")
        self._last_ack_count = 0
        self._last_delivered_count = 0
        self._last_container_state: Optional[dict] = None

    # --- Existing message fetchers ---

    def fetch_inbound(self) -> List[sqlite3.Row]:
        return self._fetch_rows(self.inbound_path, "messages_in", "last_in_seq")

    def fetch_outbound(self) -> List[sqlite3.Row]:
        return self._fetch_rows(self.outbound_path, "messages_out", "last_out_seq")

    # --- New operational data fetchers ---

    def fetch_processing_acks(self) -> List[dict]:
        """Return new processing_ack rows since last poll."""
        if not self.outbound_path.exists():
            return []
        try:
            conn = sqlite3.connect(self.outbound_path)
            conn.row_factory = sqlite3.Row
            count = conn.execute("SELECT COUNT(*) AS c FROM processing_ack").fetchone()["c"]
            if count <= self._last_ack_count:
                conn.close()
                return []
            rows = [
                dict(row)
                for row in conn.execute(
                    "SELECT * FROM processing_ack ORDER BY status_changed DESC LIMIT 10"
                ).fetchall()
            ]
            self._last_ack_count = count
            conn.close()
            return rows
        except sqlite3.DatabaseError as exc:
            log.warning("nanoclaw_acks_read_failed", session=self.session_id, error=str(exc))
            return []

    def fetch_container_state(self) -> Optional[dict]:
        """Return current container_state row if changed."""
        if not self.outbound_path.exists():
            return None
        try:
            conn = sqlite3.connect(self.outbound_path)
            conn.row_factory = sqlite3.Row
            row = conn.execute(
                "SELECT current_tool, tool_declared_timeout_ms, tool_started_at, updated_at FROM container_state WHERE id = 1"
            ).fetchone()
            conn.close()
            if not row:
                return None
            state = dict(row)
            if state == self._last_container_state:
                return None
            self._last_container_state = state
            return state
        except sqlite3.DatabaseError as exc:
            log.warning("nanoclaw_container_state_read_failed", session=self.session_id, error=str(exc))
            return None

    def fetch_delivered(self) -> List[dict]:
        """Return new delivered rows since last poll."""
        if not self.inbound_path.exists():
            return []
        try:
            conn = sqlite3.connect(self.inbound_path)
            conn.row_factory = sqlite3.Row
            count = conn.execute("SELECT COUNT(*) AS c FROM delivered").fetchone()["c"]
            if count <= self._last_delivered_count:
                conn.close()
                return []
            rows = [
                dict(row)
                for row in conn.execute(
                    "SELECT * FROM delivered ORDER BY delivered_at DESC LIMIT 10"
                ).fetchall()
            ]
            self._last_delivered_count = count
            conn.close()
            return rows
        except sqlite3.DatabaseError as exc:
            log.warning("nanoclaw_delivered_read_failed", session=self.session_id, error=str(exc))
            return []

    def heartbeat_age_ms(self) -> Optional[int]:
        """Return milliseconds since .heartbeat was last touched, or None."""
        if not self.heartbeat_path.exists():
            return None
        try:
            mtime = self.heartbeat_path.stat().st_mtime
            return int((time.time() - mtime) * 1000)
        except OSError:
            return None

    # --- Internal ---

    _ALLOWED_TABLES = frozenset({"messages_in", "messages_out"})

    def _fetch_rows(self, db_path: Path, table: str, seq_attr: str) -> List[sqlite3.Row]:
        if table not in self._ALLOWED_TABLES:
            log.warning("nanoclaw_unexpected_table", table=table)
            return []
        if not db_path.exists():
            return []
        rows: List[sqlite3.Row] = []
        try:
            conn = sqlite3.connect(db_path)
            conn.row_factory = sqlite3.Row
            # Only fetch rows from the last 5 minutes (live stream, no history).
            # Normalize timestamps via strftime to handle mixed formats:
            #   messages_in  → ISO 8601  (2026-07-28T15:59:25.339Z)
            #   messages_out → SQLite dt (2026-07-28 15:59:34)
            cutoff = (datetime.now(timezone.utc) - timedelta(minutes=5)).strftime("%Y-%m-%d %H:%M:%S")
            cursor = conn.execute(
                f"SELECT * FROM {table} WHERE seq > ? AND coalesce(strftime('%Y-%m-%d %H:%M:%S', timestamp), timestamp) >= ? ORDER BY seq",
                (getattr(self, seq_attr), cutoff),
            )
            rows = cursor.fetchall()
            if rows:
                setattr(self, seq_attr, rows[-1]["seq"])
            conn.close()
        except sqlite3.DatabaseError as exc:
            log.warning("nanoclaw_session_read_failed", session=self.session_id, error=str(exc))
        return rows

    def _prime_seq(self, db_path: Path, table: str) -> int:
        if table not in self._ALLOWED_TABLES:
            log.warning("nanoclaw_unexpected_table", table=table)
            return 0
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
        except sqlite3.DatabaseError as exc:
            log.warning("nanoclaw_prime_seq_failed", session=self.session_id, table=table, error=str(exc))
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
        self._agent_configs: Dict[str, AgentConfig] = {}
        self._sessions: Dict[str, SessionWatcher] = {}
        self._session_map: Dict[str, SessionRecord] = {}
        self._inbound_cache: "OrderedDict[str, InboundRecord]" = OrderedDict()
        self._cache_size = 5000
        self._orchestrator_id: Optional[str] = None
        self._topology_tick = 0

        if not self.central_db.exists():
            raise FileNotFoundError(f"Nanoclaw database not found at {self.central_db}")
        self._refresh_agent_groups()
        self._refresh_agent_configs()
        self._refresh_sessions()

    async def stream(self) -> AsyncIterator[TelemetryEvent]:
        initial_emitted = False

        while True:
            events = []
            try:
                self._refresh_agent_groups()
                self._refresh_agent_configs()
                self._refresh_sessions()

                # Emit initial snapshot on first loop iteration (after clients
                # have had a chance to connect)
                if not initial_emitted:
                    events.extend(self._build_initial_events())
                    initial_emitted = True

                events.extend(self._collect_events())
                events.extend(self._collect_activity_events())
                events.extend(self._collect_delivery_events())
                events.extend(self._collect_approval_events())
                topo = self._emit_topology_snapshot()
                if topo:
                    events.append(topo)
            except (sqlite3.DatabaseError, OSError, json.JSONDecodeError) as exc:
                log.warning("nanoclaw_stream_error", error=str(exc))
            for event in events:
                yield event
            await asyncio.sleep(self.poll_interval)

    # ------------------------------------------------------------------
    # Event collection
    # ------------------------------------------------------------------

    _USEFUL_SYSTEM_ACTIONS = frozenset({
        "create_agent", "schedule_task", "cancel_task",
        "install_packages", "add_mcp_server", "reset_session",
    })

    @staticmethod
    def _is_noise_message(row) -> bool:
        """Return True if this message is internal noise (CLI commands, etc.)."""
        # Handle both sqlite3.Row and dict
        try:
            kind = row["kind"]
        except (KeyError, IndexError, TypeError):
            return False
        if kind in ("chat", "chat-sdk", "task", "webhook"):
            return False
        if kind == "system":
            try:
                raw = row["content"]
            except (KeyError, IndexError):
                return True
            if raw:
                try:
                    data = json.loads(raw) if isinstance(raw, str) else raw
                    if isinstance(data, dict):
                        action = data.get("action") or data.get("payload", {}).get("action")
                        if action in NanoclawTelemetrySource._USEFUL_SYSTEM_ACTIONS:
                            return False
                except (json.JSONDecodeError, TypeError, AttributeError):
                    pass
            return True  # system messages without a useful action are noise
        return False  # unknown kinds pass through

    def _collect_events(self) -> List[TelemetryEvent]:
        events: List[TelemetryEvent] = []
        for session_id, watcher in list(self._sessions.items()):
            inbound_rows = watcher.fetch_inbound()
            for row in inbound_rows:
                if self._is_noise_message(row):
                    continue
                event = self._build_question_event(watcher, row)
                if event:
                    events.append(event)
            outbound_rows = watcher.fetch_outbound()
            for row in outbound_rows:
                # Outbound messages are responses — always show them.
                # The noise filter is for inbound CLI/system chatter only.
                event = self._build_response_event(watcher, row)
                if event:
                    events.append(event)
        return events

    def _collect_activity_events(self) -> List[TelemetryEvent]:
        """Emit activity_update events for tool state changes and processing acks."""
        events: List[TelemetryEvent] = []
        for session_id, watcher in list(self._sessions.items()):
            agent_id = watcher.agent_group_id
            config = self._agent_configs.get(agent_id)
            session_rec = self._session_map.get(session_id)

            # Container state (tool in flight)
            container_state = watcher.fetch_container_state()
            container_status = session_rec.container_status if session_rec else None
            if container_state and container_state.get("current_tool"):
                tool = container_state["current_tool"]
                timeout = container_state.get("tool_declared_timeout_ms")
                started_str = container_state.get("tool_started_at")
                elapsed = None
                if started_str:
                    try:
                        started = datetime.fromisoformat(started_str)
                        elapsed = int((datetime.now(timezone.utc) - started).total_seconds() * 1000)
                    except (ValueError, TypeError):
                        log.warning("tool_elapsed_parse_failed", session_id=session_id, started_str=started_str)

                heartbeat = watcher.heartbeat_age_ms()

                events.append(TelemetryEvent(
                    id=str(uuid4()),
                    timestamp=self._now(),
                    type=EventType.ACTIVITY_UPDATE,
                    source=f"agent:{agent_id}",
                    target="orchestrator",
                    payload=EventPayload(
                        summary=f"Running {tool}",
                        status="processing",
                        current_tool=tool,
                        tool_elapsed_ms=elapsed,
                        tool_timeout_ms=timeout,
                        provider=config.provider if config else None,
                        model=config.model if config else None,
                        skills=config.skills if config else None,
                        container_status=container_status,
                        heartbeat_age_ms=heartbeat,
                    ),
                    agent_state=AgentState.RUNNING,
                ))

            # Processing acks
            ack_rows = watcher.fetch_processing_acks()
            for ack in ack_rows:
                events.append(TelemetryEvent(
                    id=str(uuid4()),
                    timestamp=ack.get("status_changed") or self._now(),
                    type=EventType.ACTIVITY_UPDATE,
                    source=f"agent:{agent_id}",
                    target="orchestrator",
                    payload=EventPayload(
                        summary=f"Message {ack['status']}",
                        status=ack["status"],
                        provider=config.provider if config else None,
                        model=config.model if config else None,
                        container_status=container_status if session_rec else None,
                        heartbeat_age_ms=watcher.heartbeat_age_ms(),
                    ),
                    agent_state=AgentState.IDLE if ack["status"] == "completed" else AgentState.RUNNING,
                ))

        return events

    def _collect_delivery_events(self) -> List[TelemetryEvent]:
        """Emit delivery_update events from the delivered table."""
        events: List[TelemetryEvent] = []
        for session_id, watcher in list(self._sessions.items()):
            agent_id = watcher.agent_group_id
            delivered_rows = watcher.fetch_delivered()
            for row in delivered_rows:
                events.append(TelemetryEvent(
                    id=str(uuid4()),
                    timestamp=row.get("delivered_at") or self._now(),
                    type=EventType.DELIVERY_UPDATE,
                    source=f"agent:{agent_id}",
                    target="orchestrator",
                    payload=EventPayload(
                        summary=f"Message {row['status']}",
                        status=row["status"],
                        delivery_status=row["status"],
                    ),
                    agent_state=AgentState.IDLE,
                ))
        return events

    _USEFUL_APPROVAL_ACTIONS = frozenset({
        "install_packages", "add_mcp_server", "create_agent",
    })

    def _collect_approval_events(self) -> List[TelemetryEvent]:
        """Emit approval_pending events from the pending_approvals table."""
        events: List[TelemetryEvent] = []
        rows = self._query(
            self.central_db,
            "SELECT action, title, status, agent_group_id, created_at FROM pending_approvals WHERE status = 'pending' AND created_at >= ? ORDER BY created_at DESC LIMIT 20",
            (self._recent_cutoff(),),
        )
        for row in rows:
            action = row.get("action") or ""
            if action not in self._USEFUL_APPROVAL_ACTIONS:
                continue
            agent_id = row.get("agent_group_id") or self._orchestrator_id or "unknown"
            events.append(TelemetryEvent(
                id=str(uuid4()),
                timestamp=row.get("created_at") or self._now(),
                type=EventType.APPROVAL_PENDING,
                source=f"agent:{agent_id}",
                target="admin",
                payload=EventPayload(
                    summary=row.get("title") or row.get("action") or "Pending approval",
                    status="pending",
                    approval_action=row.get("action"),
                    approval_title=row.get("title"),
                ),
                agent_state=AgentState.IDLE,
            ))
        return events

    def _build_initial_events(self) -> List[TelemetryEvent]:
        """Emit initial agent_status + topology events so the dashboard renders immediately."""
        events: List[TelemetryEvent] = []
        now = self._now()

        # Agent status for every known agent group
        for ag_id, group in self._agent_groups.items():
            config = self._agent_configs.get(ag_id)
            session_rec = next(
                (s for s in self._session_map.values() if s.agent_group_id == ag_id),
                None,
            )
            events.append(TelemetryEvent(
                id=str(uuid4()),
                timestamp=now,
                type=EventType.AGENT_STATUS,
                source=f"agent:{ag_id}",
                target="orchestrator",
                payload=EventPayload(
                    summary=f"Agent {group.name} initialized",
                    status="completed",
                    provider=config.provider if config else None,
                    model=config.model if config else None,
                    skills=config.skills if config else None,
                    container_status=session_rec.container_status if session_rec else None,
                    heartbeat_age_ms=None,
                ),
                agent_state=AgentState.IDLE,
            ))

        # Topology snapshot (forced on first emission)
        topo = self._emit_topology_snapshot(force=True)
        if topo:
            events.append(topo)

        return events

    def _emit_topology_snapshot(self, force: bool = False) -> Optional[TelemetryEvent]:
        """Emit topology_snapshot every ~30 ticks (~30s at 1s poll)."""
        if not force:
            self._topology_tick += 1
            if self._topology_tick < 30:
                return None
            self._topology_tick = 0

        # Read messaging_group_agents for channel→agent routing
        channel_rows = self._query(
            self.central_db,
            """SELECT mg.channel_type, mg.platform_id, mg.name, mga.agent_group_id
               FROM messaging_group_agents mga
               JOIN messaging_groups mg ON mg.id = mga.messaging_group_id""",
        )
        channels_map: Dict[str, dict] = {}
        for row in channel_rows:
            ch_type = row.get("channel_type") or "unknown"
            if ch_type not in channels_map:
                channels_map[ch_type] = {"id": ch_type, "type": ch_type, "agents": []}
            agent_id = row.get("agent_group_id")
            if agent_id and f"agent:{agent_id}" not in channels_map[ch_type]["agents"]:
                channels_map[ch_type]["agents"].append(f"agent:{agent_id}")

        # Read agent_destinations for agent-to-agent edges
        a2a_rows = self._query(
            self.central_db,
            "SELECT agent_group_id, target_id FROM agent_destinations WHERE target_type = 'agent'",
        )
        a2a_edges = []
        for row in a2a_rows:
            src = row.get("agent_group_id")
            tgt = row.get("target_id")
            if src and tgt:
                a2a_edges.append({"source": f"agent:{src}", "target": f"agent:{tgt}"})

        channels = list(channels_map.values())
        return TelemetryEvent(
            id=str(uuid4()),
            timestamp=self._now(),
            type=EventType.TOPOLOGY_SNAPSHOT,
            source="orchestrator",
            target="dashboard",
            payload=EventPayload(
                summary=f"Topology: {len(channels)} channels, {len(a2a_edges)} a2a links",
                status="completed",
                meta={
                    "channels": json.dumps(channels, ensure_ascii=False, default=str),
                    "a2aEdges": json.dumps(a2a_edges, ensure_ascii=False, default=str),
                },
            ),
        )

    # ------------------------------------------------------------------
    # Refresh helpers
    # ------------------------------------------------------------------

    def _refresh_agent_groups(self) -> None:
        rows = self._query(self.central_db, "SELECT id, name FROM agent_groups")
        groups = {row["id"]: AgentGroup(id=row["id"], name=row["name"] or row["id"]) for row in rows}
        if groups:
            self._agent_groups = groups
            self._orchestrator_id = self._determine_orchestrator()

    def _refresh_agent_configs(self) -> None:
        """Read container_configs for all agent groups."""
        rows = self._query(
            self.central_db,
            "SELECT agent_group_id, provider, model, effort, skills, assistant_name FROM container_configs",
        )
        for row in rows:
            ag_id = row["agent_group_id"]
            skills_raw = row.get("skills")
            skills = None
            if skills_raw and skills_raw != '"all"':
                try:
                    parsed = json.loads(skills_raw)
                    if isinstance(parsed, list):
                        skills = parsed
                except (json.JSONDecodeError, TypeError) as exc:
                    log.debug("agent_skills_parse_failed", agent_group_id=ag_id, error=str(exc))
            self._agent_configs[ag_id] = AgentConfig(
                provider=row.get("provider"),
                model=row.get("model"),
                effort=row.get("effort"),
                skills=skills,
                assistant_name=row.get("assistant_name"),
            )

    def _refresh_sessions(self) -> None:
        rows = self._query(
            self.central_db,
            "SELECT id, agent_group_id, container_status, last_active FROM sessions",
        )
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
                    container_status=row.get("container_status"),
                    last_active=row.get("last_active"),
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
    # Event builders (existing, enriched)
    # ------------------------------------------------------------------

    def _build_question_event(self, watcher: SessionWatcher, row: sqlite3.Row) -> Optional[TelemetryEvent]:
        source_agent_id = None
        source_label = "User"
        source = None
        source_session_id = self._row_value(row, "source_session_id")
        if source_session_id:
            source_record = self._session_map.get(source_session_id)
            if source_record:
                source_agent_id = source_record.agent_group_id
        if source_agent_id:
            source = f"agent:{source_agent_id}"
            source_label = self._agent_label(source_agent_id)
        else:
            channel = self._row_value(row, "channel_type") or "user"
            source = f"channel:{channel}"
            source_label = channel.title()

        target_agent = f"agent:{watcher.agent_group_id}"
        config = self._agent_configs.get(watcher.agent_group_id)
        meta = {
            "sourceLabel": source_label,
            "targetLabel": self._agent_label(watcher.agent_group_id),
        }
        orchestrator_node = self._orchestrator_node()
        if orchestrator_node:
            meta["orchestratorId"] = orchestrator_node

        summary = self._summarize(self._row_value(row, "content"))
        event = TelemetryEvent(
            id=str(uuid4()),
            timestamp=self._row_value(row, "timestamp") or self._now(),
            type=EventType.QUESTION,
            source=source,
            target=target_agent,
            payload=EventPayload(
                summary=summary,
                status="running",
                duration_ms=None,
                meta=meta,
                provider=config.provider if config else None,
                model=config.model if config else None,
                skills=config.skills if config else None,
                container_status=self._session_map.get(watcher.session_id, SessionRecord("", "", Path())).container_status,
                heartbeat_age_ms=watcher.heartbeat_age_ms(),
            ),
            agent_state=AgentState.RUNNING,
        )

        self._remember_inbound(
            InboundRecord(
                message_id=row["id"],
                agent_group_id=watcher.agent_group_id,
                source_agent_id=source_agent_id,
                channel_type=self._row_value(row, "channel_type"),
                summary=summary,
            )
        )

        return event

    def _build_response_event(self, watcher: SessionWatcher, row: sqlite3.Row) -> Optional[TelemetryEvent]:
        source = f"agent:{watcher.agent_group_id}"
        source_label = self._agent_label(watcher.agent_group_id)
        target_label = None
        target = None

        if channel := self._row_value(row, "channel_type"):
            target = f"channel:{channel}"
            target_label = channel.title()
        elif reply_id := self._row_value(row, "in_reply_to"):
            cached = self._inbound_cache.get(reply_id)
            if cached:
                if cached.source_agent_id:
                    target = f"agent:{cached.source_agent_id}"
                    target_label = self._agent_label(cached.source_agent_id)
                elif cached.channel_type:
                    target = f"channel:{cached.channel_type}"
                    target_label = cached.channel_type.title()

        if not target:
            fallback_agent = self._orchestrator_id or watcher.agent_group_id
            target = f"agent:{fallback_agent}"
            target_label = self._agent_label(fallback_agent)

        config = self._agent_configs.get(watcher.agent_group_id)
        meta = {
            "sourceLabel": source_label,
            "targetLabel": target_label,
        }
        orchestrator_node = self._orchestrator_node()
        if orchestrator_node:
            meta["orchestratorId"] = orchestrator_node

        payload = EventPayload(
            summary=self._summarize(self._row_value(row, "content")),
            duration_ms=None,
            status="completed",
            meta=meta,
            provider=config.provider if config else None,
            model=config.model if config else None,
            skills=config.skills if config else None,
            container_status=self._session_map.get(watcher.session_id, SessionRecord("", "", Path())).container_status,
            heartbeat_age_ms=watcher.heartbeat_age_ms(),
        )

        return TelemetryEvent(
            id=str(uuid4()),
            timestamp=self._row_value(row, "timestamp") or self._now(),
            type=EventType.RESPONSE,
            source=source,
            target=target,
            payload=payload,
            agent_state=AgentState.IDLE,
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
        return next(iter(self._agent_groups.keys()), None)

    def _orchestrator_node(self) -> Optional[str]:
        if not self._orchestrator_id:
            return None
        return f"agent:{self._orchestrator_id}"

    def _row_value(self, row: sqlite3.Row, column: str, default: Optional[Any] = None) -> Optional[Any]:
        try:
            value = row[column]
        except (KeyError, IndexError):
            return default
        return value if value is not None else default

    def _query(self, db_path: Path, sql: str, params: tuple = ()) -> Iterable[dict]:
        """Execute a query and return rows as plain dicts (supports .get())."""
        try:
            conn = sqlite3.connect(db_path)
            conn.row_factory = sqlite3.Row
            rows = [dict(row) for row in conn.execute(sql, params).fetchall()]
            conn.close()
            return rows
        except sqlite3.DatabaseError as exc:
            log.warning("nanoclaw_query_failed", sql=sql, error=str(exc))
            return []

    @staticmethod
    def _recent_cutoff(minutes: int = 5) -> str:
        """Return ISO timestamp for N minutes ago."""
        return (datetime.now(timezone.utc) - timedelta(minutes=minutes)).isoformat()

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
