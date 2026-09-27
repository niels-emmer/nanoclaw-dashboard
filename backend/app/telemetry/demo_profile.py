"""Demo profile for the mock telemetry source.

A realistic multi-tier agent network an engineer would use, with coherent
demo message content. All names and content are generic — no personal or
identifying information. The human-facing agent is ``concierge`` (a role, not
a person); the orchestrator remains the tree root.

Hierarchy (3 tiers):

    orchestrator
    ├── concierge            (human-facing, whatsapp channel)
    ├── route-planner        (dispatch lead)
    │   ├── route-optimizer
    │   └── route-validator
    ├── architect / researcher / editor / terminal / plotter
    └── coder
        ├── reviewer
        └── tester

The demo story: an engineer messages the concierge via whatsapp, the
concierge routes the request to the orchestrator, which decomposes it across
the specialist tiers; results flow back and the concierge reports to the
human. Human-channel events drive the Human node in the UI.
"""

# Full demo roster. The demo profile overrides the configured agent list so
# the hierarchy is always complete regardless of NANOCLAW_MOCK_AGENT_NAMES.
DEMO_AGENTS: list[str] = [
    "concierge",
    "route-planner",
    "route-optimizer",
    "route-validator",
    "architect",
    "researcher",
    "coder",
    "reviewer",
    "tester",
    "editor",
    "terminal",
    "plotter",
]

# Skills/models for agents not in the default profile. Specialists reuse the
# default content; these dicts are merged over the defaults.
DEMO_SKILLS: dict[str, list[str]] = {
    "concierge": ["message-routing", "human-handoff", "status-summary"],
    "reviewer": ["code-review", "diff-inspect", "security-scan"],
    "tester": ["unit-test", "integration-test", "regression-check"],
}

DEMO_MODELS: dict[str, tuple[str, str]] = {
    "concierge": ("claude", "sonnet"),
    "reviewer": ("claude", "sonnet"),
    "tester": ("claude", "haiku"),
}

# Orchestrator-facing content for the new agents (merged over defaults).
DEMO_QUESTIONS: dict[str, list[str]] = {
    "concierge": [
        "Handle the incoming request from the human channel",
        "Route the new feature request to the right specialists",
        "Give a status update on the checkout latency investigation",
        "Coordinate the handoff for the billing dashboard rollout",
    ],
    "reviewer": [
        "Review the auth middleware implementation",
        "Check the payment refactor for security issues",
        "Review the WebSocket connection cleanup fix",
    ],
    "tester": [
        "Run the unit suite for the auth middleware",
        "Write integration tests for the payment flow",
        "Regression-test the WebSocket fix",
    ],
}

DEMO_RESPONSES: dict[str, list[str]] = {
    "concierge": [
        "Request routed to researcher, coder, and terminal",
        "Feature request decomposed and dispatched to the specialists",
        "Status: researcher found the cache-miss spike, coder is applying the fix",
        "Handoff complete — billing dashboard is on staging, tester ran the smoke suite",
    ],
    "reviewer": [
        "LGTM — found one edge case in token refresh, fixed and added a test.",
        "Two findings: a hardcoded secret in config and a missing rate limit on the retry path. Both addressed.",
        "Clean — the cleanup handles the close race properly.",
    ],
    "tester": [
        "2,847 tests passed, 3 flaky quarantined. Build green.",
        "Integration suite green — 142 scenarios, 0 failures.",
        "Regression suite passed — no new failures introduced.",
    ],
}

# Human-facing content: the engineer's message and the concierge's reply.
# These pair with the specialist content so the demo reads as one story.
DEMO_HUMAN_QUESTIONS: list[str] = [
    "Why is checkout latency spiking in production?",
    "Can you ship the new billing dashboard to staging?",
    "Investigate the memory leak in the event loop we saw last night",
    "What's the status on the multi-tenant schema migration?",
    "Prep the Q3 revenue numbers for the board deck",
]

DEMO_HUMAN_RESPONSES: list[str] = [
    "On it — routed to researcher, coder, and terminal. I'll report back shortly.",
    "Done — billing dashboard is on staging, smoke tests green.",
    "Memory leak traced to unclosed WebSocket connections — fix is in review.",
    "Migration is 70% done — architect finished the schema, coder is on the data backfill.",
    "Q3 numbers ready — plotter generated the charts, editor polished the deck.",
]

# Agent-to-agent communication patterns matching the hierarchy.
DEMO_A2A_PATTERNS: list[tuple[str, str, str, str]] = [
    ("architect", "coder", "Review the implementation plan for the new API gateway",
     "Plan reviewed. The rate limiter needs a Redis backend instead of in-memory."),
    ("coder", "reviewer", "Review the auth middleware implementation",
     "LGTM — one edge case in token refresh fixed, test added."),
    ("coder", "tester", "Run the unit suite for the auth middleware",
     "2,847 tests passed, 3 flaky quarantined. Build green."),
    ("researcher", "editor", "Draft a summary of the vector database research findings",
     "Summary drafted. Recommendation: start with Pinecone."),
    ("terminal", "plotter", "Generate a chart from the latest benchmark results",
     "Benchmark chart generated. 40% improvement on complex joins."),
    ("route-planner", "route-optimizer", "Tune the routing weights for the new workstream",
     "Weights tuned — p95 latency down 18%."),
    ("route-planner", "route-validator", "Validate the routing plan for the rollout",
     "Plan verified: acyclic, no deadlocks, safe to proceed."),
]

# Topology: one real human channel (whatsapp) for the concierge, a2a edges
# matching the hierarchy, and the explicit multi-tier tree.
DEMO_CHANNELS: list[dict] = [
    {"id": "whatsapp", "type": "whatsapp", "agents": ["agent:concierge"]},
]

DEMO_A2A_EDGES: list[dict] = [
    {"source": "agent:architect", "target": "agent:coder"},
    {"source": "agent:coder", "target": "agent:reviewer"},
    {"source": "agent:coder", "target": "agent:tester"},
    {"source": "agent:researcher", "target": "agent:editor"},
    {"source": "agent:terminal", "target": "agent:plotter"},
    {"source": "agent:route-planner", "target": "agent:route-optimizer"},
    {"source": "agent:route-planner", "target": "agent:route-validator"},
]

DEMO_TREE: dict = {
    "root": "orchestrator",
    "children": {
        "agent:route-planner": ["agent:route-optimizer", "agent:route-validator"],
        "agent:coder": ["agent:reviewer", "agent:tester"],
    },
}

# Human-facing agent + its real channel (drives the Human node in the UI).
DEMO_HUMAN_AGENT: str = "concierge"
DEMO_HUMAN_CHANNEL: str = "whatsapp"