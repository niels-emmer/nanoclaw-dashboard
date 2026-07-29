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

# Realistic task summaries per agent
_QUESTIONS: dict[str, list[str]] = {
    "researcher": [
        "Research the latest trends in vector databases for our semantic search feature",
        "Find documentation for the Stripe payment webhook API",
        "Compare pricing between AWS Bedrock and GCP Vertex AI",
        "Look up best practices for rate-limiting in distributed systems",
        "Investigate the root cause of the production latency spike",
    ],
    "coder": [
        "Implement the user authentication middleware for the API gateway",
        "Refactor the payment processing module to reduce technical debt",
        "Fix the memory leak in the WebSocket event loop",
        "Add input validation to the file upload endpoint",
        "Optimize the database query for the dashboard analytics view",
    ],
    "architect": [
        "Review the microservices decomposition proposal for the billing domain",
        "Design the database schema for the new multi-tenant feature",
        "Evaluate the caching strategy for the content delivery pipeline",
        "Assess the migration path from monolith to event-driven architecture",
        "Define the API contract for the notification service integration",
    ],
    "editor": [
        "Proofread the API documentation draft for the v3 release",
        "Format the release notes for the upcoming v2.1 sprint",
        "Review the technical blog post about the new architecture",
        "Copy-edit the onboarding guide for new team members",
        "Check consistency of terminology across the developer docs",
    ],
    "terminal": [
        "Run the full test suite for the CI pipeline and report results",
        "Deploy the staging environment for the new feature branch",
        "Check disk usage and memory metrics on the production servers",
        "Execute the database migration script for the schema update",
        "Tail the application logs to debug the authentication errors",
    ],
    "plotter": [
        "Generate the Q3 revenue chart for the board presentation",
        "Create a dashboard for user engagement metrics over the past month",
        "Plot the API latency distribution graph from the benchmark run",
        "Visualize the deployment frequency and change failure rate trends",
        "Build a heatmap of error rates by service and region",
    ],
}

_RESPONSES: dict[str, list[str]] = {
    "researcher": [
        "Found three leading vector database options: Pinecone, Weaviate, and Qdrant. Pinecone has the best managed experience.",
        "Stripe webhook API docs are located at /webhooks with signature verification using the webhook secret key.",
        "AWS Bedrock is more cost-effective at scale, while GCP Vertex AI offers better integration with their data platform.",
        "Rate-limiting best practices suggest a token bucket algorithm with per-user and per-endpoint limits.",
        "The latency spike correlates with a 5x increase in cache misses after the last deployment.",
    ],
    "coder": [
        "Authentication middleware implemented with JWT validation, rate limiting, and role-based access control.",
        "Payment module refactored into three services: authorization, capture, and reconciliation.",
        "Memory leak traced to unclosed WebSocket connections in the event handler — added proper cleanup.",
        "File upload validation added: file type whitelist, size limit (10MB), and virus scanning integration.",
        "Dashboard query optimized by adding composite indexes and materializing the aggregation results.",
    ],
    "architect": [
        "Recommended splitting billing into 4 services: invoicing, payments, subscriptions, and usage tracking.",
        "Multi-tenant schema designed with row-level security and a shared pool model for small tenants.",
        "Suggested a multi-layer cache: CDN for static content, Redis for API responses, and Memcached for sessions.",
        "Migration plan: strangler fig pattern over 6 months, starting with the notification service.",
        "API contract defined as OpenAPI 3.1 spec with async event schemas for the notification service.",
    ],
    "editor": [
        "API docs proofread and updated for consistency. Found 12 terminology inconsistencies and fixed them.",
        "Release notes formatted with sections for features, fixes, and deprecations. Ready for review.",
        "Blog post reviewed. Major suggestion: add a diagram showing the before/after architecture comparison.",
        "Onboarding guide copy-edited. Added a quick-start section and fixed the broken links.",
        "Terminology audit complete. Standardized on 'service' instead of 'microservice' throughout.",
    ],
    "terminal": [
        "Test suite: 2,847 tests passed, 3 flaky tests identified and quarantined. Build is green.",
        "Staging environment deployed successfully. Running smoke tests against the new endpoints.",
        "Disk usage at 72% on prod-1, 68% on prod-2. Memory pressure is normal. No alerts triggered.",
        "Database migration executed in 12.4s. All foreign key constraints validated post-migration.",
        "Logs show authentication errors from an expired API key on the integration service. Rotated the key.",
    ],
    "plotter": [
        "Q3 revenue chart generated: 23% growth YoY, with a notable spike in September from the enterprise tier.",
        "User engagement dashboard shows MAU up 15% with a 15-day streak feature driving retention.",
        "Latency distribution: p50=45ms, p95=120ms, p99=350ms. The p99 spike correlates with batch jobs.",
        "Deployment frequency chart: 12 deploys/week, change failure rate at 4%, well below the 15% target.",
        "Error heatmap shows the payments service in us-east-1 has the highest error rate at 2.3%.",
    ],
}

# Agent-to-agent communication patterns
_A2A_PATTERNS: list[tuple[str, str, str, str]] = [
    ("architect", "coder", "Review the implementation plan for the new API gateway",
     "Plan reviewed. Noticed the rate limiter needs a Redis backend instead of in-memory."),
    ("coder", "architect", "Request clarification on the database schema for multi-tenancy",
     "The tenant isolation strategy uses a shared pool with row-level security, not separate databases."),
    ("researcher", "editor", "Draft a summary of the vector database research findings",
     "Summary drafted. Key recommendation: start with Pinecone for its managed infrastructure."),
    ("terminal", "plotter", "Generate a chart from the latest benchmark results",
     "Benchmark chart generated. The new query optimizer shows 40% improvement on complex joins."),
    ("architect", "terminal", "Provision a staging environment for the new billing service",
     "Staging environment provisioned with the billing service stack. Ready for integration tests."),
    ("researcher", "coder", "Share the API documentation links for the Stripe integration",
     "Stripe API docs shared. Key endpoints: /charges, /webhooks, and /customers."),
]


class MockTelemetrySource(TelemetrySource):
    """Synthetic event generator for demos and tests."""

    def __init__(self, agent_names: list[str], base_interval_ms: int, jitter_ms: int) -> None:
        self._agents = agent_names
        self._interval = base_interval_ms
        self._jitter = jitter_ms
        self._tool_states: dict[str, dict] = {}  # agent -> {tool, started_at}
        self._topology_timer = 0.0
        self._idle_agents: set[str] = set()

    async def stream(self) -> AsyncIterator[TelemetryEvent]:
        agents_cycle = itertools_cycle(self._agents)
        tick = 0
        while True:
            agent = next(agents_cycle)
            tick += 1

            # Occasionally mark an agent as idle (skip its turn)
            if random.random() < 0.15 and agent not in self._idle_agents:
                self._idle_agents.add(agent)
                # Emit an agent_status event showing idle
                yield self._build_agent_status(agent, AgentState.IDLE)
                await asyncio.sleep(self._sleep_seconds() * 0.5)
                continue

            # Occasionally wake up an idle agent
            if agent in self._idle_agents and random.random() < 0.3:
                self._idle_agents.discard(agent)

            # Occasionally trigger agent-to-agent communication
            if random.random() < 0.2:
                a2a = random.choice(_A2A_PATTERNS)
                src, tgt, question_text, response_text = a2a
                if src in self._agents and tgt in self._agents:
                    for evt in self._emit_a2a_conversation(src, tgt, question_text, response_text):
                        yield evt
                    await asyncio.sleep(self._sleep_seconds() * 0.8)
                    continue

            # --- Core orchestrator → agent flow ---
            question_text = random.choice(_QUESTIONS.get(agent, ["Process the assigned task"]))
            question = self._build_event(
                EventType.QUESTION,
                source="orchestrator",
                target=f"agent:{agent}",
                summary=question_text,
                agent_state=AgentState.RUNNING,
            )
            yield question
            await asyncio.sleep(self._sleep_seconds())

            # Simulate tool activity (not always — sometimes the agent responds immediately)
            if random.random() < 0.6:
                tool_events = self._simulate_tool_activity(agent)
                for evt in tool_events:
                    yield evt
                    await asyncio.sleep(self._sleep_seconds() * 0.3)

            # Response from agent
            response_text = random.choice(_RESPONSES.get(agent, ["Task completed."]))
            response = self._build_event(
                EventType.RESPONSE,
                source=f"agent:{agent}",
                target="orchestrator",
                summary=response_text,
                agent_state=random.choice([AgentState.IDLE, AgentState.IDLE, AgentState.RUNNING]),
            )
            response.payload.duration_ms = random.randint(500, 5000)
            response.payload.status = "completed"
            yield response
            await asyncio.sleep(self._sleep_seconds())

            # --- Occasional delivery update ---
            if random.random() < 0.2:
                yield self._build_delivery_event(agent)

            # --- Occasional approval pending ---
            if random.random() < 0.06:
                yield self._build_approval_event(agent)

            # --- Occasional error ---
            if random.random() < 0.04:
                yield self._build_error_event(agent)

            # --- Topology snapshot (every ~12 ticks) ---
            self._topology_timer += 1
            if self._topology_timer >= 12:
                self._topology_timer = 0
                yield self._build_topology_event()

    def _emit_a2a_conversation(self, src: str, tgt: str, question_text: str, response_text: str) -> list[TelemetryEvent]:
        """Emit a question/response pair between two agents."""
        events: list[TelemetryEvent] = []

        q = self._build_event(
            EventType.QUESTION,
            source=f"agent:{src}",
            target=f"agent:{tgt}",
            summary=question_text,
            agent_state=AgentState.RUNNING,
        )
        events.append(q)

        r = self._build_event(
            EventType.RESPONSE,
            source=f"agent:{tgt}",
            target=f"agent:{src}",
            summary=response_text,
            agent_state=AgentState.IDLE,
        )
        r.payload.duration_ms = random.randint(1000, 4000)
        r.payload.status = "completed"
        events.append(r)

        return events

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

    def _build_error_event(self, agent: str) -> TelemetryEvent:
        """Emit an agent_status event with error state."""
        errors = [
            "Tool execution timed out after 120s",
            "Failed to parse response from language model",
            "Connection refused to external API endpoint",
            "Out of memory while processing large document",
        ]
        return TelemetryEvent(
            id=str(uuid4()),
            timestamp=_timestamp(),
            type=EventType.AGENT_STATUS,
            source=f"agent:{agent}",
            target="orchestrator",
            payload=EventPayload(
                summary=random.choice(errors),
                status="error",
                duration_ms=random.randint(5000, 30000),
            ),
            agent_state=AgentState.ERROR,
        )

    def _build_agent_status(self, agent: str, state: AgentState) -> TelemetryEvent:
        """Emit a simple agent_status event."""
        return TelemetryEvent(
            id=str(uuid4()),
            timestamp=_timestamp(),
            type=EventType.AGENT_STATUS,
            source=f"agent:{agent}",
            target="orchestrator",
            payload=EventPayload(
                summary=f"Agent is {state.value}",
                status="completed",
            ),
            agent_state=state,
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
            {"source": "agent:terminal", "target": "agent:plotter"},
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

    def _build_event(
        self,
        event_type: EventType,
        source: str,
        target: str,
        summary: str | None = None,
        agent_state: AgentState | None = None,
    ) -> TelemetryEvent:
        agent_ref = target if event_type == EventType.QUESTION else source
        agent_name = agent_ref.removeprefix("agent:") if agent_ref.startswith("agent:") else None
        meta: dict[str, str] = {}
        if agent_name and agent_name in _AGENT_SKILLS:
            meta["skills"] = ",".join(_AGENT_SKILLS[agent_name])
        provider, model = _AGENT_MODELS.get(agent_name, ("", "")) if agent_name else ("", "")
        payload = EventPayload(
            summary=summary or f"{event_type.value.title()} to {target}",
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
            agent_state=agent_state or (AgentState.RUNNING if event_type == EventType.QUESTION else AgentState.IDLE),
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
