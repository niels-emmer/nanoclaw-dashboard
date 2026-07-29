# Architecture Overview

The dashboard is split into a FastAPI WebSocket service (`/backend`) and a Vite + React + TS SPA (`/frontend`). The backend emits canonical telemetry events about the orchestrator/sub-agent conversation; the frontend ingests the stream, animates a flow canvas, and presents supporting diagnostics (agent cards, event feed, debug panel) for a single-screen 1080p display.

## Backend (`backend/`)

| Module | Responsibility |
|--------|----------------|
| `app/config.py` | Centralizes runtime settings via `pydantic-settings` (env prefix `NANOCLAW_`). Controls transport type, mock agent list, pacing, and client limits. |
| `app/telemetry/models.py` | Canonical event schema shared with the frontend (type, payload, agent state, schema version). |
| `app/telemetry/source.py` | Declares `TelemetrySource` interface + `MockTelemetrySource` generator that emits realistic orchestrator/sub-agent traffic: question/response pairs with agent-to-agent conversations, varied agent states (idle/running/error), tool activity updates, delivery signals, approval requests, and topology snapshots. |
| `app/telemetry/nanoclaw.py` | `NanoclawTelemetrySource` tails the Nanoclaw SQLite databases (central `v2.db` + session `inbound/outbound.db`) and emits live orchestrator/sub-agent events when enabled. |
| `app/events.py` | `EventHub` tracks connected WebSocket clients with backpressure (max clients) and broadcasts JSON payloads. |
| `app/main.py` | FastAPI app factory with `/health` and `/ws/events`. Lifespan task drives the telemetry loop and pushes events into `EventHub`. |
| `app/logging.py` | structlog JSON logging config shared across modules. |
| `app/cli.py` | Convenience entry point for `uvicorn`. |

### Data flow

1. `TelemetrySource.stream()` yields `TelemetryEvent` instances forever. By default this is the mock generator; when `NANOCLAW_ENABLED=true` it becomes `NanoclawTelemetrySource`, which polls the Nanoclaw session folders for new rows.
2. The lifespan task in `app/main.py` awaits each event and hands it to `EventHub.broadcast`, which fans it out to all registered WebSocket clients as JSON.
3. Clients connect to `/ws/events`; the backend enforces a `max_clients` soft limit and gracefully drops sockets on send errors.
4. Health monitoring: `/health` returns `{ "status": "ok" }` for integration tests and uptime probes.

### Live agent ops data pipeline

Beyond the core question/response flow, the backend reads operational tables from the Nanoclaw databases to emit richer telemetry:

| Event type | Source table(s) | What it conveys |
|------------|----------------|-----------------|
| `activity_update` | `container_state` (outbound.db), `processing_ack` (outbound.db) | Current tool the agent is running (Bash, Read, etc.), elapsed time, timeout, processing status per message |
| `delivery_update` | `delivered` (inbound.db) | Whether an outbound message was delivered or failed |
| `approval_pending` | `pending_approvals` (central v2.db) | Admin actions awaiting approval (install_packages, add_mcp_server, etc.) |
| `topology_snapshot` | `messaging_group_agents`, `agent_destinations` (central v2.db) | Routing graph: which channels feed which agents, agent-to-agent connections |

Additional fields on all event types:

| Field | Source | Purpose |
|-------|--------|---------|
| `provider`, `model` | `container_configs` (central v2.db) | Agent capabilities (claude/sonnet, etc.) |
| `skills` | `container_configs` (central v2.db) | List of skill names the agent has loaded |
| `container_status` | `sessions` (central v2.db) | Container runtime state: running, idle, or stopped |
| `heartbeat_age_ms` | `.heartbeat` file mtime | Milliseconds since last container liveness signal |
| `current_tool`, `tool_elapsed_ms`, `tool_timeout_ms` | `container_state` (outbound.db) | Real-time tool execution state |
| `retry_count` | `messages_in.tries` (inbound.db) | Number of retry attempts for a message |
| `delivery_status` | `delivered` (inbound.db) | Delivery outcome: delivered or failed |

### Testing hooks

- `tests/test_app.py` covers `/health` to ensure the FastAPI stack boots.
- `tests/test_telemetry.py` covers the mock source: question/response flow, emission of all new event types, and presence of tool state fields on activity_update events.
- Structured logs surface in JSON for later ingestion into observability stacks.

## Frontend (`frontend/`)

| Area | Key files | Notes |
|------|-----------|-------|
| Event ingestion | `src/hooks/useEventStream.ts`, `src/lib/config.ts`, `src/lib/types.ts`, `src/lib/utils.ts` | Custom hook manages the WebSocket connection (auto-reconnect, edge TTLs, snapshots). Config infers backend URL, with overrides via `VITE_BACKEND_WS_URL`. |
| Visualization | `src/components/FlowCanvas.tsx` | SVG orbit layout with orchestrator at center, deterministic spokes for agents, animated edge pulses, tool badge (colored circle with white icon below label when tool active), liveness ring (dashed inner circle when stale/dead), agent-to-agent edges, hover tooltips, and click-to-filter. |
| Details panes | `AgentGrid.tsx`, `EventFeed.tsx`, `DebugPanel.tsx`, `ConnectionStatus.tsx` | Present agent states, recent events, raw payloads, and connection indicators with purposeful typography and color tokens. |
| Shell | `App.tsx`, `App.css`, `index.css` | Hero masthead with capability Chip rail + streaming legend feeds into a fixed two-column layout (orbit canvas + insight grid). Uses HeroUI Card/Chip/Typography components on Tailwind CSS v4. |

`npm run dev` starts Vite on `5173`. When the dev server runs on `5173`, the SPA automatically targets `ws://localhost:8000/ws/events`; otherwise set `VITE_BACKEND_WS_URL`.

## Canonical event schema

`backend/app/telemetry/models.py` defines the source of truth and is mirrored in `frontend/src/lib/types.ts`.

```json
{
  "id": "UUID",
  "timestamp": "ISO-8601",
  "type": "question | response | agent_status | activity_update | delivery_update | approval_pending | topology_snapshot",
  "source": "orchestrator | agent:<name> | channel:<type>",
  "target": "agent:<name> | orchestrator | admin | dashboard",
  "payload": {
    "summary": "string (≤240 chars)",
    "duration_ms": "int | null",
    "status": "running | completed | error | pending | processing | delivered | failed",
    "meta": "{ channels, a2aEdges } | null",

    "current_tool": "string | null",
    "tool_elapsed_ms": "int | null",
    "tool_timeout_ms": "int | null",

    "provider": "string | null",
    "model": "string | null",
    "skills": ["string"] | null,

    "container_status": "string | null",
    "heartbeat_age_ms": "int | null",

    "retry_count": "int | null",
    "delivery_status": "string | null",

    "approval_action": "string | null",
    "approval_title": "string | null"
  },
  "agent_state": "spinning_up | idle | running | error | null",
  "schema_version": "0.2.0"
}
```

When new telemetry attributes are required, bump `schema_version`, update both the backend model and frontend types, and add an ADR entry.

## Configuration + environment

- Backend config derives from env vars prefixed with `NANOCLAW_` (see `config.py`). Example knobs: `NANOCLAW_MOCK_AGENT_NAMES`, `NANOCLAW_BASE_INTERVAL_MS`, `NANOCLAW_MAX_CLIENTS`.
- Frontend config relies on Vite env vars: `VITE_BACKEND_WS_URL`, `VITE_EVENT_HISTORY` (default 200).
- Node `20.19.0` is required; we vendor the tarball under `.tools/node` for deterministic teams.

## Nanoclaw integration

- Enabling: set `NANOCLAW_ENABLED=true` and point `NANOCLAW_ROOT` (CLI/dev) or the compose bind (`NANOCLAW_HOST_DATA` → `NANOCLAW_CONTAINER_DATA`) at the Nanoclaw checkout. The backend mounts the folder read-only.
- Data sources: `NanoclawTelemetrySource` reads the following tables across the three Nanoclaw databases:

  | Database | Tables read | Purpose |
  |----------|-------------|---------|
  | Central `v2.db` | `agent_groups`, `sessions`, `container_configs`, `pending_approvals`, `messaging_group_agents`, `agent_destinations` | Agent metadata, container state, capabilities, approvals, routing topology |
  | Session `inbound.db` | `messages_in`, `delivered` | Inbound messages, delivery status |
  | Session `outbound.db` | `messages_out`, `processing_ack`, `container_state` | Outbound messages, processing lifecycle, current tool in flight |
  | Filesystem | `.heartbeat` file mtime | Container liveness signal |

  It maps `messages_in.source_session_id` to discover agent-to-agent traffic and correlates `messages_out.in_reply_to` with the cached inbound rows for response edges.
- Safety: only read operations are performed. If the mount is missing/unreadable the backend logs a warning and falls back to the mock generator.

## Observability + debugging

- Backend logs: JSON via structlog, ready for ingestion.
- Frontend: connection status chip, live edge pulses, and a collapsible debug panel that dumps the latest raw event payload for onboarding/troubleshooting.

## Containerization

- `backend/Dockerfile` packages the FastAPI app on top of `python:3.11-slim` and exposes port `8000`.
- `frontend/Dockerfile` builds the SPA with `node:20.19.0`, then serves the `dist/` bundle via nginx. `frontend/nginx.conf` proxies `/ws/` traffic to the backend container, so browsers can use same-origin WebSocket URLs.
- `docker-compose.yml` wires both services together, reading defaults from `.env` and exposing ports `BACKEND_PORT` (default `8000`) and `FRONTEND_PORT` (default `4173`).

## Future extensions

- Wire SBOM generation (Syft recommended) into CI for both stacks.
- Add integration tests that spin up the backend, run the frontend in headless mode (Playwright/Cypress), and assert render correctness.
- Token usage / cost tracking: nanoclaw does not persist token counts in its DB schema. Would require upstream changes or parsing provider API responses.
- Error detail propagation: `processing_ack` only stores `failed` status, not the error reason. Would need nanoclaw changes to persist error details.
