# Mission-critical context
- Single-screen 1080p dashboard for the nanoclaw orchestrator delegating work to sub-agents with live animation of questions/responses.
- Backend streams mock telemetry over WebSocket by default (no nanoclaw install needed); frontend SPA renders the orbit canvas + agent/event panes.
- Maintain: centered orchestrator, directional pulses (outward for questions, inward for responses), 1080p-friendly layout.

# File layout at a glance
```
nanoclaw-dashboard/
├── backend/
│   ├── app/
│   │   ├── main.py               # FastAPI app factory, lifespan, /health + /ws/events
│   │   ├── config.py              # Pydantic settings (env prefix NANOCLAW_)
│   │   ├── events.py              # EventHub — broadcast to WS clients
│   │   ├── logging.py             # structlog JSON config
│   │   ├── cli.py                 # CLI entry point
│   │   └── telemetry/
│   │       ├── models.py          # Canonical event schema (source of truth)
│   │       ├── source.py          # TelemetrySource interface + MockTelemetrySource
│   │       └── nanoclaw.py        # NanoclawTelemetrySource (live data tailer)
│   ├── tests/
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/            # FlowCanvas, AgentGrid, EventFeed, DebugPanel, ConnectionStatus
│   │   ├── hooks/useEventStream.ts  # WebSocket ingest + reconnect + edge derivation
│   │   ├── lib/
│   │   │   ├── types.ts           # Telemetry TS types (mirrors backend models.py)
│   │   │   ├── config.ts          # Backend URL resolution
│   │   │   └── utils.ts
│   │   ├── App.tsx / App.css / index.css  # Shell + color/typography tokens
│   ├── Dockerfile
│   ├── nginx.conf                 # Proxies /ws/ to backend container
│   └── package.json
├── docs/
│   ├── ARCHITECTURE.md
│   ├── DECISIONS.md
│   ├── screenshot.png
│   └── threat-models/2026-07-25.md
├── scripts/install_dashboard.sh
├── .github/                       # Issue/PR templates, CODEOWNERS
├── docker-compose.yml
└── .env                           # Backend/frontend defaults
```

# Defaults & port mappings
- Backend dev: `uvicorn app.main:app --reload --port 8000` → http://localhost:8000, health at /health
- Frontend dev: `npm run dev` (Vite) → http://localhost:5173, connects to `ws://localhost:8000/ws/events`
- Docker: backend on ${BACKEND_PORT:-8000}, frontend on ${FRONTEND_PORT:-4173}, nginx proxies /ws/ → backend
- Mock telemetry is the default (NANOCLAW_ENABLED=false); no nanoclaw host needed.
- Override WebSocket endpoint: `VITE_BACKEND_WS_URL` env var.

# Architecture expectations
- Backend: FastAPI + WebSocket `/ws/events`, `TelemetrySource` abstraction, structlog JSON logging, pytest coverage. Swap mock for real feed by implementing a new TelemetrySource + ADR entry.
- Frontend: Vite + React + TypeScript, custom SVG orbit renderer (`FlowCanvas`), dedicated `useEventStream` hook for ingest/retry logic, toggleable debug panel. Color/typography tokens in `frontend/src/index.css`.
- Docker: `backend/Dockerfile` (python:3.11-slim + uvicorn), `frontend/Dockerfile` (node:20.19 build → nginx serve), `docker-compose.yml` orchestrates both.

# Visual + UX requirements
- Animate directional edges for questions vs responses; differentiate state changes (agent spin-up, in-flight, response) with motion + color.
- Purposeful typography (Space Grotesk + IBM Plex Sans, no default system stack), dark background with gradient, defined color story.
- Meaningful motion only—avoid noisy micro-animations.

# Governance + Required Docs
- Governance is normative: threat modeling, dependency pinning, SBOMs, ADRs, and documentation are mandatory.
- Keep all doc files current before merging (README.md, docs/ARCHITECTURE.md, SECURITY.md, THIRD_PARTY.md, docs/DECISIONS.md).
- Threat model every new network interface or data store and link the artifact in docs/DECISIONS.md.
- Current threat model: `docs/threat-models/2026-07-25.md` (WebSocket surface).
- When altering telemetry schema or transport, bump `schema_version`, update frontend `types.ts`, and add an ADR entry.

# Implementation checklist
- Node **20.19.0** (Vite/Rolldown requirement), Python **3.11+**.
- Before pushing: `cd backend && pytest` and `cd frontend && npm run lint && npm run build`.
- Keep `THIRD_PARTY.md` in sync with new dependencies (exact version + license + notes).
- Prefer `./scripts/install_dashboard.sh` for provisioning; update it when workflows change.
- Container workflow: `docker compose up --build` reads `.env` defaults. Update Compose + nginx.conf if transport paths change.
- When wiring to a real Nanoclaw host: require read-only bind mount (`NANOCLAW_HOST_DATA` → `NANOCLAW_CONTAINER_DATA`), set `NANOCLAW_ENABLED=true`. Never write to the mounted data folder.
