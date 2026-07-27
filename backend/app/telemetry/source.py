"""Telemetry source abstractions."""

from __future__ import annotations

import asyncio
import random
from uuid import uuid4
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import AsyncIterator

from .models import AgentState, EventPayload, EventType, TelemetryEvent


class TelemetrySource(ABC):
    """Base interface for emitting telemetry events."""

    @abstractmethod
    async def stream(self) -> AsyncIterator[TelemetryEvent]:
        """Yield telemetry events indefinitely."""


_AGENT_SKILLS: dict[str, list[str]] = {
    "researcher": ["web-search", "document-scrape", "fact-check"],
    "coder": ["code-review", "git-commit", "unit-test"],
    "architect": ["design-review", "dependency-graph", "db-schema"],
    "editor": ["copy-edit", "style-guide", "format"],
    "terminal": ["shell-exec", "log-parse", "env-inspect"],
    "plotter": ["chart-js", "svg-render", "data-plot"],
}

_AGENT_MODELS: dict[str, tuple[str, str]] = {
    "researcher": ("claude", "sonnet"),
    "coder": ("claude", "sonnet"),
    "architect": ("claude", "opus"),
    "editor": ("claude", "haiku"),
    "terminal": ("opencode", "gpt-4o"),
    "plotter": ("claude", "sonnet"),
}

_TOOLS = ["Bash", "Read", "Write", "Edit", "Glob", "Grep", "WebSearch", "WebFetch"]
_TOOL_TIMEOUTS = {"Bash": 120_000, "Read": 30_000, "Write": 30_000, "Edit": 30_000, "Glob": 15_000, "Grep": 15_000, "WebSearch": 20_000, "WebFetch": 20_000}


class MockTelemetrySource(TelemetrySource):
    """Synthetic event generator for demos and tests."""

    def __init__(self, agent_names: list[str], base_interval_ms: int, jitter_ms: int) -> None:
        self._agents = agent_names
        self._interval = base_interval_ms
        self._jitter = jitter_ms
        self._tool_states: dict[str, dict] = {}  # agent -> {tool, started_at}
        self._topology_timer = 0.0

    async def stream(self) -> AsyncIterator[TelemetryEvent]:
        agents_cycle = itertools_cycle(self._agents)
        tick = 0
        while True:
            agent = next(agents_cycle)
            tick += 1

            # --- Core question/response flow (existing) ---
            question = self._build_event(EventType.QUESTION, source="orchestrator", target=f"agent:{agent}")
            yield question
            await asyncio.sleep(self._sleep_seconds())

            # Simulate tool activity before responding
            if random.random() < 0.7:
                tool_events = self._simulate_tool_activity(agent)
                for evt in tool_events:
                    yield evt
                    await asyncio.sleep(self._sleep_seconds() * 0.3)

            response_type = EventType.RESPONSE
            duration = random.randint(200, 2000)
            meta: dict[str, str] = {}
            if agent in _AGENT_SKILLS:
                meta["skills"] = ",".join(_AGENT_SKILLS[agent])
            payload = EventPayload(
                summary=f"Response from {agent}",
                duration_ms=duration,
                status="completed",
                meta=meta or None,
            )
            response = TelemetryEvent(
                id=str(uuid4()),
                timestamp=_timestamp(),
                type=response_type,
                source=f"agent:{agent}",
                target="orchestrator",
                payload=payload,
                agent_state=random.choice(list(AgentState)),
            )
            yield response
            await asyncio.sleep(self._sleep_seconds())

            # --- New: delivery update ---
            if random.random() < 0.3:
                yield self._build_delivery_event(agent)

            # --- New: approval pending (occasional) ---
            if random.random() < 0.08:
                yield self._build_approval_event(agent)

            # --- New: topology snapshot (every ~10 ticks) ---
            self._topology_timer += 1
            if self._topology_timer >= 10:
                self._topology_timer = 0
                yield self._build_topology_event()

    def _simulate_tool_activity(self, agent: str) -> list[TelemetryEvent]:
        """Emit activity_update events simulating a tool run."""
        tool = random.choice(_TOOLS)
        timeout = _TOOL_TIMEOUTS.get(tool, 30_000)
        elapsed = random.randint(2000, min(timeout, 15000))
        provider, model = _AGENT_MODELS.get(agent, ("claude", "sonnet"))
        skills = _AGENT_SKILLS.get(agent, [])

        # Tool start
        start_event = TelemetryEvent(
            id=str(uuid4()),
            timestamp=_timestamp(),
            type=EventType.ACTIVITY_UPDATE,
            source=f"agent:{agent}",
            target="orchestrator",
            payload=EventPayload(
                summary=f"Running {tool}",
                status="processing",
                current_tool=tool,
                tool_elapsed_ms=0,
                tool_timeout_ms=timeout,
                provider=provider,
                model=model,
                skills=skills,
                container_status="running",
                heartbeat_age_ms=random.randint(100, 5000),
            ),
            agent_state=AgentState.RUNNING,
        )

        # Tool in progress
        progress_event = TelemetryEvent(
            id=str(uuid4()),
            timestamp=_timestamp(),
            type=EventType.ACTIVITY_UPDATE,
            source=f"agent:{agent}",
            target="orchestrator",
            payload=EventPayload(
                summary=f"Running {tool} ({elapsed // 1000}s)",
                status="processing",
                current_tool=tool,
                tool_elapsed_ms=elapsed,
                tool_timeout_ms=timeout,
                provider=provider,
                model=model,
                skills=skills,
                container_status="running",
                heartbeat_age_ms=random.randint(100, 5000),
            ),
            agent_state=AgentState.RUNNING,
        )

        return [start_event, progress_event]

    def _build_delivery_event(self, agent: str) -> TelemetryEvent:
        """Emit a delivery_update event."""
        delivered = random.random() < 0.9
        return TelemetryEvent(
            id=str(uuid4()),
            timestamp=_timestamp(),
            type=EventType.DELIVERY_UPDATE,
            source=f"agent:{agent}",
            target="orchestrator",
            payload=EventPayload(
                summary=f"Message {'delivered' if delivered else 'failed'} to channel",
                status="delivered" if delivered else "failed",
                delivery_status="delivered" if delivered else "failed",
                duration_ms=random.randint(100, 3000),
                retry_count=0 if delivered else random.randint(1, 3),
            ),
            agent_state=AgentState.IDLE,
        )

    def _build_approval_event(self, agent: str) -> TelemetryEvent:
        """Emit an approval_pending event."""
        actions = ["install_packages", "add_mcp_server", "create_agent"]
        action = random.choice(actions)
        titles = {
            "install_packages": "Install lodash and axios",
            "add_mcp_server": "Add GitHub MCP server",
            "create_agent": "Create sub-agent 'reviewer'",
        }
        return TelemetryEvent(
            id=str(uuid4()),
            timestamp=_timestamp(),
            type=EventType.APPROVAL_PENDING,
            source=f"agent:{agent}",
            target="admin",
            payload=EventPayload(
                summary=titles.get(action, action),
                status="pending",
                approval_action=action,
                approval_title=titles.get(action, action),
            ),
            agent_state=AgentState.IDLE,
        )

    def _build_topology_event(self) -> TelemetryEvent:
        """Emit a topology_snapshot event with the routing graph."""
        channels = [
            {"id": "telegram", "type": "telegram", "agents": ["agent:coder", "agent:terminal"]},
            {"id": "discord", "type": "discord", "agents": ["agent:architect", "agent:editor"]},
            {"id": "slack", "type": "slack", "agents": ["agent:researcher", "agent:plotter"]},
        ]
        a2a_edges = [
            {"source": "agent:architect", "target": "agent:coder"},
            {"source": "agent:researcher", "target": "agent:editor"},
        ]
        return TelemetryEvent(
            id=str(uuid4()),
            timestamp=_timestamp(),
            type=EventType.TOPOLOGY_SNAPSHOT,
            source="orchestrator",
            target="dashboard",
            payload=EventPayload(
                summary=f"Topology: {len(channels)} channels, {len(a2a_edges)} a2a links",
                status="completed",
                meta={
                    "channels": _json_dumps(channels),
                    "a2aEdges": _json_dumps(a2a_edges),
                },
            ),
        )

    def _build_event(self, event_type: EventType, source: str, target: str) -> TelemetryEvent:
        agent_ref = target if event_type == EventType.QUESTION else source
        agent_name = agent_ref.removeprefix("agent:") if agent_ref.startswith("agent:") else None
        meta: dict[str, str] = {}
        if agent_name and agent_name in _AGENT_SKILLS:
            meta["skills"] = ",".join(_AGENT_SKILLS[agent_name])
        provider, model = _AGENT_MODELS.get(agent_name, ("", "")) if agent_name else ("", "")
        payload = EventPayload(
            summary=f"{event_type.value.title()} to {target}",
            duration_ms=None,
            status="running",
            meta=meta or None,
            provider=provider or None,
            model=model or None,
            skills=_AGENT_SKILLS.get(agent_name) if agent_name else None,
            container_status="running",
            heartbeat_age_ms=random.randint(100, 3000),
        )
        return TelemetryEvent(
            id=str(uuid4()),
            timestamp=_timestamp(),
            type=event_type,
            source=source,
            target=target,
            payload=payload,
            agent_state=AgentState.RUNNING if event_type == EventType.QUESTION else AgentState.IDLE,
        )

    def _sleep_seconds(self) -> float:
        jitter = random.uniform(-self._jitter, self._jitter)
        interval = max(100, self._interval + jitter)
        return interval / 1000


def _timestamp() -> str:
    return datetime.now(timezone.utc).isoformat()


def _json_dumps(obj) -> str:
    import json
    return json.dumps(obj, ensure_ascii=False, default=str)


def itertools_cycle(values: list[str]):
    while True:
        for value in values:
            yield value
