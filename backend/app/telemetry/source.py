"""Telemetry source abstractions."""

from __future__ import annotations

import asyncio
import platform
import random
import socket
import time
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
    "route-planner": ["route-plan", "dependency-graph", "task-decompose"],
    "route-optimizer": ["cost-model", "latency-opt", "route-tune"],
    "route-validator": ["route-check", "constraint-verify", "safety-gate"],
}

_AGENT_MODELS: dict[str, tuple[str, str]] = {
    "researcher": ("claude", "sonnet"),
    "coder": ("claude", "sonnet"),
    "architect": ("claude", "opus"),
    "editor": ("claude", "haiku"),
    "terminal": ("opencode", "gpt-4o"),
    "plotter": ("claude", "sonnet"),
    "route-planner": ("claude", "opus"),
    "route-optimizer": ("claude", "haiku"),
    "route-validator": ("claude", "haiku"),
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
    "route-planner": [
        "Plan the optimal routing for the multi-agent delivery pipeline",
        "Decompose the migration task into parallel sub-agent workstreams",
        "Design the dependency graph for the new feature rollout",
        "Route the incoming request to the appropriate specialist agents",
        "Coordinate the handoff between the research and implementation phases",
    ],
    "route-optimizer": [
        "Tune the routing weights to minimize end-to-end latency",
        "Optimize the cost model for the agent dispatch strategy",
        "Adjust the parallel fan-out to balance throughput and cost",
        "Profile the routing bottlenecks in the delivery pipeline",
        "Recommend a cheaper model tier for low-priority sub-tasks",
    ],
    "route-validator": [
        "Verify the routing plan satisfies all hard constraints",
        "Check that every sub-task has a valid destination agent",
        "Validate the dependency graph for cycles and deadlocks",
        "Confirm the handoff contracts between parent and sub-agents",
        "Gate the rollout until all routing checks pass",
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
    "route-planner": [
        "Routing plan complete: 3 parallel workstreams, each with a dedicated specialist and a shared synthesis step.",
        "Task decomposed into 4 sub-tasks routed to researcher, coder, terminal, and plotter.",
        "Dependency graph designed with 2 critical paths and a single merge point at the synthesizer.",
        "Request routed to route-optimizer and route-validator for tuning and safety checks.",
        "Handoff plan finalized: research → implementation → validation, with checkpoints at each boundary.",
    ],
    "route-optimizer": [
        "Routing weights tuned: p95 latency down 18% by rebalancing fan-out across the two sub-agents.",
        "Cost model optimized: switched 3 low-priority sub-tasks to the haiku tier, saving 22%.",
        "Parallel fan-out adjusted to 2 concurrent sub-agents to balance throughput and cost.",
        "Bottleneck identified at the validator gate; added a retry budget to smooth the spike.",
        "Recommended a cheaper model tier for the route-validator's routine checks.",
    ],
    "route-validator": [
        "Routing plan verified: all 4 sub-tasks have valid destinations, no cycles detected.",
        "Constraint check passed: every handoff contract matches the parent's declared interface.",
        "Dependency graph validated: acyclic, 2 critical paths, no deadlocks.",
        "Handoff contracts confirmed between route-planner and both sub-agents.",
        "Rollout gated: all routing checks green, safe to proceed.",
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
        self._topology_timer = 0.0
        self._idle_agents: set[str] = set()
        # Instance-level state for instance_info / config_snapshot events
        self._started_at = time.monotonic()
        self._messages_total = 0
        self._errors_total = 0
        self._instance_timer = 0
        self._config_timer = 0
        self._cpu_pct = 32.0
        self._mem_used_mb = 4096.0
        self._token_used = 45_000
        self._time_to_reset_ms = random.randint(15, 90) * 60_000

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
            self._messages_total += 1
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
            self._messages_total += 1
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
                self._errors_total += 1
                yield self._build_error_event(agent)

            # --- Topology snapshot (every ~12 ticks) ---
            self._topology_timer += 1
            if self._topology_timer >= 12:
                self._topology_timer = 0
                yield self._build_topology_event()

            # --- Instance info snapshot (every ~10 ticks) ---
            self._instance_timer += 1
            if self._instance_timer >= 10:
                self._instance_timer = 0
                yield self._build_instance_info()

            # --- Config snapshot (every ~40 ticks) ---
            self._config_timer += 1
            if self._config_timer >= 40:
                self._config_timer = 0
                yield self._build_config_snapshot()

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
        self._messages_total += 1
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
        self._messages_total += 1
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
        # Parent-child hierarchy (sub-agents reporting to a parent agent).
        # Root is the orchestrator; children map a parent agent to its sub-agents.
        tree = {
            "root": "orchestrator",
            "children": {
                "agent:route-planner": ["agent:route-optimizer", "agent:route-validator"],
            },
        }
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
                    "tree": _json_dumps(tree),
                },
            ),
        )

    def _build_instance_info(self) -> TelemetryEvent:
        """Emit an instance_info snapshot with instance details + metrics."""
        uptime_ms = int((time.monotonic() - self._started_at) * 1000)

        # Random-walk resources so the numbers drift realistically between snapshots.
        self._cpu_pct = min(95.0, max(5.0, self._cpu_pct + random.uniform(-8, 8)))
        self._mem_used_mb = min(14_000.0, max(2_000.0, self._mem_used_mb + random.uniform(-300, 300)))
        self._token_used = min(190_000, max(10_000, self._token_used + random.randint(-8_000, 12_000)))
        # Monotonic countdown so the "time to reset" metric ticks down, not jumps.
        self._time_to_reset_ms = max(0, self._time_to_reset_ms - 10_000)
        if self._time_to_reset_ms <= 0:
            self._time_to_reset_ms = random.randint(15, 90) * 60_000

        skills = sorted({s for group in _AGENT_SKILLS.values() for s in group})
        models = sorted({f"{provider}/{model}" for provider, model in _AGENT_MODELS.values()})
        agents = [
            {
                "id": f"agent:{name}",
                "label": name,
                "state": "running" if name not in self._idle_agents else "idle",
            }
            for name in self._agents
        ]
        active_agents = sum(1 for a in agents if a["state"] == "running")

        instance = {
            "version": "0.3.0",
            "uptimeMs": uptime_ms,
            "host": {
                "hostname": socket.gethostname(),
                "platform": platform.system().lower(),
                "pythonVersion": platform.python_version(),
                "container": "docker",
            },
            "resources": {
                "cpuPercent": round(self._cpu_pct, 1),
                "memoryUsedMb": round(self._mem_used_mb),
                "memoryTotalMb": 16_384,
                "diskUsedMb": 102_400,
                "diskTotalMb": 512_000,
            },
            "skills": skills,
            "models": models,
            "agents": agents,
            "tools": _TOOLS,
            "metrics": {
                "messagesTotal": self._messages_total,
                "errorsTotal": self._errors_total,
                "tokenBufferUsed": self._token_used,
                "tokenBufferLimit": 200_000,
                "timeToResetMs": self._time_to_reset_ms,
                "activeAgents": active_agents,
            },
        }
        return TelemetryEvent(
            id=str(uuid4()),
            timestamp=_timestamp(),
            type=EventType.INSTANCE_INFO,
            source="orchestrator",
            target="dashboard",
            payload=EventPayload(
                summary=f"Instance: {len(agents)} agents, {len(skills)} skills, {len(models)} models",
                status="completed",
                meta={"instance": _json_dumps(instance)},
            ),
        )

    def _build_config_snapshot(self) -> TelemetryEvent:
        """Emit a config_snapshot with the config folder tree (metadata only).

        File contents are served on demand via ``GET /api/config/file``.
        """
        groups = self._build_mock_config_groups()
        for group in groups:
            group["files"] = [
                {"id": f["id"], "path": f["path"], "name": f["name"]}
                for f in group["files"]
            ]
        total_files = sum(len(g["files"]) for g in groups)
        return TelemetryEvent(
            id=str(uuid4()),
            timestamp=_timestamp(),
            type=EventType.CONFIG_SNAPSHOT,
            source="orchestrator",
            target="dashboard",
            payload=EventPayload(
                summary=f"Config: {len(groups)} groups, {total_files} files",
                status="completed",
                meta={"groups": _json_dumps(groups)},
            ),
        )

    def _build_mock_config_groups(self) -> list[dict]:
        """Synthetic user/group configuration files (markdown) grouped logically."""
        groups: list[dict] = []

        # Agents — one file per agent describing role, model, and skills.
        agent_files = []
        for name in self._agents:
            skills = ", ".join(_AGENT_SKILLS.get(name, [])) or "none"
            provider, model = _AGENT_MODELS.get(name, ("claude", "sonnet"))
            agent_files.append({
                "id": f"agents/{name}",
                "path": f"agents/{name}.md",
                "name": f"{name}.md",
                "content": (
                    f"# {name.title()}\n\n"
                    f"Role: {name.replace('-', ' ')} specialist\n"
                    f"Model: {provider}/{model}\n"
                    f"Skills: {skills}\n\n"
                    "## Instructions\n"
                    f"- Handle tasks routed to the {name} agent.\n"
                    "- Report progress via activity updates.\n"
                    "- Escalate to the orchestrator on failure.\n"
                ),
            })
        groups.append({"id": "agents", "label": "Agents", "files": agent_files})

        # Skills
        skill_files = [
            {
                "id": "skills/code-review",
                "path": "skills/code-review.md",
                "name": "code-review.md",
                "content": "# Code Review\n\n- Check for correctness, security, and style.\n- Verify tests cover the change.\n- Flag secrets and hardcoded credentials.\n",
            },
            {
                "id": "skills/web-search",
                "path": "skills/web-search.md",
                "name": "web-search.md",
                "content": "# Web Search\n\n- Prefer primary sources.\n- Cite URLs in responses.\n- Note the publication date of sources.\n",
            },
            {
                "id": "skills/unit-test",
                "path": "skills/unit-test.md",
                "name": "unit-test.md",
                "content": "# Unit Tests\n\n- One behavior per test.\n- Mock external services.\n- Cover edge cases and error paths.\n",
            },
        ]
        groups.append({"id": "skills", "label": "Skills", "files": skill_files})

        # Workflow & governance
        workflow_files = [
            {
                "id": "workflow/agents",
                "path": "workflow/AGENTS.md",
                "name": "AGENTS.md",
                "content": "# Agent Instructions\n\nThis file defines how agents behave in this workspace.\n\n- Run /start at session begin.\n- Plan before non-trivial edits.\n- Verify before completion.\n",
            },
            {
                "id": "workflow/playbook",
                "path": "workflow/OPENCODE_WORKFLOW.md",
                "name": "OPENCODE_WORKFLOW.md",
                "content": "# Workflow Playbook\n\n- Run /start at session begin.\n- Plan before non-trivial edits.\n- Delegate intentionally.\n- Verify before completion.\n- Document the session.\n",
            },
            {
                "id": "workflow/governance",
                "path": "workflow/governance.md",
                "name": "governance.md",
                "content": "# Governance\n\n- Classify data before cloud model use.\n- No secrets in prompts or code.\n- Audit AI-driven changes.\n- Pin dependencies with compatible licenses.\n",
            },
        ]
        groups.append({"id": "workflow", "label": "Workflow & Governance", "files": workflow_files})

        # Global / user
        global_files = [
            {
                "id": "global/global-agents",
                "path": "~/.config/opencode/AGENTS.md",
                "name": "AGENTS.md",
                "content": "# Global Rules\n\n- Think before coding.\n- Simplicity first.\n- Surgical changes only.\n- Verify before done.\n",
            },
            {
                "id": "global/opencode-json",
                "path": "~/.config/opencode/opencode.json",
                "name": "opencode.json",
                "content": "{\n  \"model\": \"opencode/deepseek-v4-flash\",\n  \"permissions\": {}\n}\n",
            },
        ]
        groups.append({"id": "global", "label": "Global / User", "files": global_files})

        return groups

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
