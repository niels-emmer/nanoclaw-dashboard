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


class MockTelemetrySource(TelemetrySource):
    """Synthetic event generator for demos and tests."""

    def __init__(self, agent_names: list[str], base_interval_ms: int, jitter_ms: int) -> None:
        self._agents = agent_names
        self._interval = base_interval_ms
        self._jitter = jitter_ms

    async def stream(self) -> AsyncIterator[TelemetryEvent]:
        agents_cycle = itertools_cycle(self._agents)
        while True:
            agent = next(agents_cycle)
            question = self._build_event(EventType.QUESTION, source="orchestrator", target=f"agent:{agent}")
            yield question
            await asyncio.sleep(self._sleep_seconds())

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

    def _build_event(self, event_type: EventType, source: str, target: str) -> TelemetryEvent:
        agent_ref = target if event_type == EventType.QUESTION else source
        agent_name = agent_ref.removeprefix("agent:") if agent_ref.startswith("agent:") else None
        meta: dict[str, str] = {}
        if agent_name and agent_name in _AGENT_SKILLS:
            meta["skills"] = ",".join(_AGENT_SKILLS[agent_name])
        payload = EventPayload(
            summary=f"{event_type.value.title()} to {target}",
            duration_ms=None,
            status="running",
            meta=meta or None,
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


def itertools_cycle(values: list[str]):
    while True:
        for value in values:
            yield value
