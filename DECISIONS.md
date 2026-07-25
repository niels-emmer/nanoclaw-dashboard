# Decision Log

Document architectural decisions here (lightweight ADRs). Each entry cites rationale + governance alignment.

## 0001 – Dual-stack scaffold with FastAPI + SPA
- **Status**: Proposed
- **Context**: Dashboard must stream orchestrator/sub-agent telemetry in real time and render a flow-chart visualization on a 1080p display.
- **Decision**: Build two top-level packages: `/backend` (FastAPI + WebSocket/SSE) and `/frontend` (modern SPA, e.g., Vite + React + TS). Backend emits canonical events consumed by the frontend via a single `/events` stream. Mock telemetry source exists until nanoclaw feed is available.
- **Consequences**:
  - Enables isolated development/testing per stack while sharing an agreed schema.
  - Requires shared validation library or generated types to avoid drift.
  - CI must run backend + frontend pipelines plus schema contract tests.

## 0002 – Enforce governance charter
- **Status**: Accepted
- **Context**: Owner mandated adoption of `agent-governance/GOVERNANCE.md` across all repos.
- **Decision**: Treat the charter as normative; threat modeling, documentation set, dependency pinning, SBOMs, and ADR logging are mandatory.
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
