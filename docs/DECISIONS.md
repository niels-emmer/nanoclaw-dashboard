# Decision Log

Document architectural decisions here (lightweight ADRs). Each entry cites rationale + governance alignment.

## 0001 – Dual-stack scaffold with FastAPI + SPA
- **Status**: Accepted (2026-07-25)
- **Context**: Dashboard must stream orchestrator/sub-agent telemetry in real time and render a flow-chart visualization on a 1080p display.
- **Decision**: Build two top-level packages: `/backend` (FastAPI + WebSocket/SSE) and `/frontend` (modern SPA, e.g., Vite + React + TS). Backend emits canonical events consumed by the frontend via a single `/events` stream. Mock telemetry source exists until nanoclaw feed is available.
- **Consequences**:
  - Enables isolated development/testing per stack while sharing an agreed schema.
  - Requires shared validation library or generated types to avoid drift.
  - CI must run backend + frontend pipelines plus schema contract tests.

## 0002 – Enforce governance charter
- **Status**: Accepted
- **Context**: Owner mandated adoption of a governance charter across all repos.
- **Decision**: Threat modeling, documentation set, dependency pinning, SBOMs, and ADR logging are mandatory.
- **Consequences**:
  - Contributors must update this log for material changes (dependencies, data models, protocols).
  - CI pipeline must include security scans and SBOM generation before releases.

## 0003 – WebSocket transport with mock telemetry source
- **Status**: Accepted (2026-07-25)
- **Context**: Need a real-time, bidirectional-capable channel to broadcast orchestrator telemetry, even before the real nanoclaw feed is wired.
- **Decision**: Use FastAPI WebSockets at `/ws/events` backed by `EventHub` with a pluggable `TelemetrySource` interface. Ship with `MockTelemetrySource` that emits alternating question/response pairs to unblock UI work.
- **Consequences**:
  - Threat model captured in `docs/threat-models/2026-07-25.md`; revisit once real feed introduces authentication requirements.
  - Frontend connects via `ws://` in dev; production deployments must terminate TLS at the edge.
  - `EventHub` limits concurrent clients to avoid DoS but needs per-IP throttling before internet exposure.

## 0004 – Vite + React visualization stack with SVG orbit renderer
- **Status**: Accepted (2026-07-25)
- **Context**: UI must animate directional question/response edges, keep orchestrator centered, and run smoothly on 1080p displays.
- **Decision**: Build the SPA with Vite 8 + React 19 + TypeScript, using a custom SVG-based orbit layout (`FlowCanvas`). Node 20.19.0 is the supported runtime to satisfy Vite/Rolldown engine constraints.
- **Consequences**:
  - Frontend hook (`useEventStream`) owns connection/retry logic; any stateful additions should extend this hook rather than reimplement WebSocket wiring.
  - Layout + color tokens live in `src/index.css` / `App.css`; keep them cohesive when extending the design.
  - Document Node requirement in README and ensure CI uses the same version.

## 0005 – Containerized deployment via Docker Compose
- **Status**: Accepted (2026-07-25)
- **Context**: Operators requested an easier way to run the dashboard on nanoclaw hosts without managing Python/Node manually.
- **Decision**: Provide a Docker-based workflow: `backend/Dockerfile` (Python 3.11 slim + uvicorn), `frontend/Dockerfile` (Node 20.19.0 build → nginx runtime), `frontend/nginx.conf` (proxies `/ws/` to backend), `.env` for defaults, and `docker-compose.yml` to orchestrate both services.
- **Consequences**:
  - Browser clients talk to the frontend container, which serves static assets and forwards WebSocket traffic to `backend:8000`, keeping URLs same-origin.
  - Future backend/ frontend env changes must be reflected in `.env` and Compose definitions.
  - CI should eventually add `docker compose build` smoke tests to ensure container images stay healthy.

## 0006 – Read-only Nanoclaw telemetry tailer
- **Status**: Accepted (2026-07-25)
- **Context**: The dashboard needs to display real orchestrator/sub-agent activity from the host Nanoclaw instance without adding a new RPC surface.
- **Decision**: Implement `NanoclawTelemetrySource`, which mounts the Nanoclaw checkout read-only, reads agent/session metadata from `data/v2.db`, and tails each session’s `inbound.db`/`outbound.db` pair for new rows. Events are emitted over the existing `/ws/events` channel, preserving the canonical schema.
- **Consequences**:
  - Requires operators to opt in via `NANOCLAW_ENABLED=true` and provide a bind mount; when absent the backend automatically falls back to the synthetic generator.
  - Only read operations occur; no code writes to the Nanoclaw data folder, reducing risk of corrupting the host install.
  - Threat model remains focused on the WebSocket surface; if future versions add authenticated RPCs, update the model and ADR.

## 0007 – Live agent ops: tool state, liveness, delivery, topology
- **Status**: Accepted (2026-07-27)
- **Context**: The dashboard showed only question/response message flow. Operators needed visibility into what agents are doing right now (current tool, elapsed time), whether containers are alive, whether messages were delivered, pending admin approvals, and the routing topology.
- **Decision**: Extend `NanoclawTelemetrySource` to read 6 additional operational tables (`container_configs`, `container_state`, `processing_ack`, `delivered`, `pending_approvals`, `messaging_group_agents`, `agent_destinations`) plus the `.heartbeat` file. Add 4 new event types (`activity_update`, `delivery_update`, `approval_pending`, `topology_snapshot`) and 12 new payload fields. On the frontend, replace the generic pulse ring with a color-coded tool indicator arc, add liveness dots, skills dots, channel nodes on an outer ring, agent-to-agent edges, hover tooltips, click-to-filter, and a health summary in the header.
- **Consequences**:
  - Backend now reads 10+ tables across 3 databases; schema drift in nanoclaw is handled gracefully (missing columns return None, missing tables return empty).
  - Mock telemetry source updated to emit all new event types so frontend dev works without nanoclaw.
  - Canvas visual density increased but all additions replace or augment existing elements (no new panels).
  - Token usage/cost data is not available from nanoclaw's DB schema — would require upstream changes.
  - Bumped `schema_version` from `0.1.0` to `0.2.0`.

## 0008 – WebSocket event ring buffer
- **Status**: Accepted (2026-07-29)
- **Context**: On page refresh or client connect, the dashboard started empty and waited for live events to arrive. Operators needed immediate historical context without adding a separate REST fetching step.
- **Decision**: Implement a bounded ring buffer (`deque(maxlen=event_buffer_size)`) inside `EventHub`. Every broadcast event is stored in the buffer. Upon client WebSocket registration, `EventHub` flushes the buffered events to the new client before live streaming begins.
- **Consequences**:
  - Eliminates initial empty state on dashboard refresh; dashboard populates instantly.
  - Configured via `NANOCLAW_EVENT_BUFFER_SIZE` (default 100, max 1000). Memory impact is negligible (~50 KB for 100 events).
  - Works identically for mock and real Nanoclaw telemetry sources without frontend contract changes.

## 0009 – Canvas agent decay & brand color system
- **Status**: Accepted (2026-07-29)
- **Context**: As dozens of agents accumulate on the orbit canvas over long runs, the canvas becomes visually cluttered. Also, entity badges and orbit nodes needed consistent brand colors across canvas and grid.
- **Decision**: Implement linear opacity decay on `FlowCanvas` based on `agent.lastUpdated` (`VITE_AGENT_SOLID_MINUTES` = 10m solid, `VITE_AGENT_FADE_MINUTES` = 60m linear fade, auto-removed from layout at 70m). Any new event resets `lastUpdated` to `Date.now()`. Implement brand-pinned colors for channels (`whatsapp`: `#25D366`, `matrix`/`element`: `#0DBD8B`, `slack`: `#e01e5a`, `discord`: `#5865f2`, `telegram`: `#229ed9`) and sub-agents, with normalized string key hashing for unpinned agents.
- **Consequences**:
  - Orbit canvas remains clean and readable on 1080p displays during extended operations.
  - Agent color blobs in the AgentGrid match orbit canvas nodes 100% deterministically.
  - Decay timeouts are configurable via frontend environment variables.

## 0010 – Dashboard UI/UX improvements (2026-07-31)
- **Status**: Merged (PR #21)
- **Context**: The dashboard needed better live traffic visibility, 1080p readability, and reduced visual noise for always-on multi-agent monitoring.
- **Decision**: Comprehensive frontend overhaul across 4 phases: critical UX fixes (EventFeed filtering, chat bubble collision avoidance), layout rebalancing (AgentGrid/EventFeed ratio, masthead simplification), animation tuning (reduced motion support, grid opacity), and architecture improvements (Error Boundary, Debug Panel, SVG accessibility).
- **Consequences**:
  - EventFeed now shows `activity_update` events with type filter bar and delivery toggle
  - Chat bubbles use collision avoidance with dashed connector lines to agent nodes
  - AgentGrid uses border separators instead of Card wrappers for tighter spacing
  - Agent decay tuned to 15m solid / 90m fade (from 10m/60m)
  - Full `prefers-reduced-motion` support added
  - Error Boundary wraps entire app with fallback UI

## 0011 – Node version lockfile discipline (2026-07-31)
- **Status**: Active
- **Context**: CI uses Node 20.19.0 but local dev used Node 24.12.0. Different Node versions resolve different optional dependencies (`@emnapi/*`), causing `npm ci` failures in CI.
- **Decision**: Always regenerate `package-lock.json` with the CI's Node version (20.19.0 from `.tools/node/bin/npm`).
- **Consequences**:
  - Lockfile must be generated with Node 20.19.0 to match CI
  - Local dev can use any Node version, but lockfile updates require the pinned version

## 0012 – `.env` git tracking removal (2026-07-30)
- **Status**: Active
- **Context**: `.env` was tracked in git history until commit `5cb7ac4` where it was removed with `git rm --cached .env`. Remote machines (nanoclaw host) still see it as tracked.
- **Decision**: `.env` is now in `.gitignore` and untracked. Users with existing clones must run `git rm --cached .env` before pulling.
- **Consequences**:
  - New clones use `.env.example` as template
  - Existing clones need `git rm --cached .env` + `mv .env .env.bak` + `git pull` + `mv .env.bak .env` to preserve local values
