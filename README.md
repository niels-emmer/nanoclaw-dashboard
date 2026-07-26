# Nanoclaw Dashboard

Live, single-screen telemetry dashboard that shows the nanoclaw orchestrator delegating work to sub-agents. The backend (FastAPI) emits canonical events over WebSocket, and the frontend (Vite + React + TS) renders an animated flow-map tuned for 1080p displays with directional edge pulses for questions vs. responses.

## Stack at a glance

| Layer     | Tech                                                          | Notes |
|-----------|---------------------------------------------------------------|-------|
| Backend   | FastAPI + Uvicorn, structlog, Pydantic Settings               | Provides `/health` + `/ws/events` WebSocket streaming mock telemetry by default (or live Nanoclaw data when enabled). |
| Frontend  | Vite + React + TypeScript + Tailwind CSS v4 + HeroUI v3       | Full-screen flow canvas, agent grid, event log, toggleable debug panel. HeroUI provides Card, Chip, Typography components. |
| Tooling   | pytest + pytest-asyncio, npm scripts, Node 20.19, Python 3.11 | Both stacks pin dependencies per governance. |

## Prerequisites

- Python **3.11+** (backend uses newer typing + Pydantic v2).
- Node.js **20.19.0** (Vite 8 + rolldown require ≥20.19). Local installs live under `.tools/node` for reproducibility.
- A POSIX shell; macOS Ventura+ tested.

## Quick start

**One-shot installer (recommended):**

```bash
./scripts/install_dashboard.sh
```

The script provisions `.venv`, installs backend deps, fetches Node **20.19.0** into `.tools/node`, installs frontend deps, then runs `pytest`, `npm run lint`, and `npm run build`. When it finishes you can start the dev servers:

```bash
source .venv/bin/activate && cd backend && uvicorn app.main:app --reload --port 8000
PATH=$PWD/.tools/node/bin:$PATH cd frontend && npm run dev
```

**Manual setup (if you can’t run the script):**

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r backend/requirements.txt
cd backend && pytest && uvicorn app.main:app --reload --port 8000

PATH=$PWD/.tools/node/bin:$PATH npm --prefix frontend install
PATH=$PWD/.tools/node/bin:$PATH npm --prefix frontend run dev
```

The frontend auto-connects to `ws://localhost:8000/ws/events` when it detects the Vite dev port (`5173`). Override with `VITE_BACKEND_WS_URL` if you proxy or deploy elsewhere.

### Connect to a local Nanoclaw host

1. Ensure the Nanoclaw checkout (the directory that contains `data/v2.db`) is readable from this repo. The default assumes `../nanoclaw` relative to the dashboard root.
2. Update `.env`:
   - `NANOCLAW_ENABLED=true`
   - `NANOCLAW_HOST_DATA` → absolute path to your Nanoclaw checkout (e.g. `/home/niels/nanoclaw`).
   - `NANOCLAW_CONTAINER_DATA` → mount point inside the backend container (default `/nanoclaw`).
   - Optionally set `NANOCLAW_ORCHESTRATOR_GROUP` to the agent group id or name you want centered in the orbit (falls back to the first group or the one containing "orchestrator").
3. Rebuild/restart the backend (`docker compose up --build backend` or `uvicorn` locally). The backend mounts the Nanoclaw data folder read-only and tails `data/v2.db` plus the per-session `inbound.db`/`outbound.db` files to emit real events.

The integration is read-only: the backend never mutates Nanoclaw files, and all access stays within the mounted checkout. If the mount is missing or unreadable, the backend automatically falls back to the synthetic telemetry source.

## Docker workflow

1. Adjust `.env` if you want different exposed ports or backend settings.
2. Build + run both services:

```bash
docker compose up --build
```

- Frontend is available at `http://localhost:${FRONTEND_PORT}` (default `4173`).
- Backend health check lives at `http://localhost:${BACKEND_PORT}/health` (default `8000`).

The frontend container serves the built SPA via nginx and proxies `/ws/*` to the backend service, so same-origin WebSocket URLs just work. Rebuild after changing frontend env vars (`docker compose build frontend`).

## Build + verification

- **Backend tests**: `cd backend && pytest`
- **Frontend build**: `PATH=$PWD/.tools/node/bin:$PATH && cd frontend && npm run build`
- **Frontend lint**: `npm run lint` (oxlint)

Add regression tests for every bug fix and include SBOM generation steps in CI (Syft recommended; see `DECISIONS.md`).

## Telemetry model

Canonical event schema is defined in `backend/app/telemetry/models.py` and mirrored for the client in `frontend/src/lib/types.ts`. Each event carries:

```json
{
  "id": "uuid",
  "timestamp": "ISO-8601",
  "type": "question|response|agent_status",
  "source": "orchestrator|agent:<name>",
  "target": "agent:<name>|orchestrator",
  "payload": { "summary": "...", "duration_ms": 1200, "status": "running" },
  "agent_state": "idle|running|spinning_up|error"
}
```

Mock telemetry (`MockTelemetrySource`) emits alternating question/response pairs, seeded with deterministic agent names until the real Nanoclaw feed is connected. When `NANOCLAW_ENABLED=true`, the backend switches to `NanoclawTelemetrySource`, which:

- Reads agent metadata from `data/v2.db`.
- Tails each session’s `inbound.db` / `outbound.db` pairs to detect new inter-agent messages and channel traffic.
- Emits the same canonical events with additional metadata (friendly labels) so the frontend animates the actual orchestrator/sub-agent conversations.

Keep the schema versioned and update `DECISIONS.md` whenever the payload changes.

## Layout + UX highlights

- Flow canvas keeps the orchestrator centered with sub-agents on a deterministic orbit, now paired with a contextual legend that mirrors the Fast.io streaming vs. response vs. status split.
- Hero masthead introduces a capability pill rail (real-time streaming, observability, multimodal readiness) inspired by the [Fast.io "Best UI Frameworks for AI Agents" (2026)](https://fast.io/resources/best-ui-frameworks-ai-agents/) guidance.
- Agent grid cards summarize last summary/state/timestamp for each agent, while a new status block in the masthead surfaces active agents, live pulses, and the last signal.
- Event feed still streams the latest eight events with timestamps, and the new "Interface tenets" panel documents the same transparency/streaming tenets called out in the Fast.io article.
- Layout locks into a two-column orbit canvas + insight stack so everything fits on a bezel-less 1080p TV without scrolling, matching the Nanoclaw operations requirement.
- Debug panel (toggle at bottom) dumps the most recent raw event for troubleshooting.

Typography uses Space Grotesk + IBM Plex Sans, with a refreshed multi-stop gradient background tuned for 1080p displays. Avoid introducing new fonts/colors without updating the shared tokens in `src/index.css`.

## Documentation map

- `AGENTS.md` – high-signal instructions + day-one checklist.
- `ARCHITECTURE.md` – system design, flow, and component responsibilities.
- `SECURITY.md` – controls + threat model hooks.
- `THIRD_PARTY.md` – ledger for dependencies + licenses.
- `DECISIONS.md` – ADR log (transport choice, schema revs, etc.).
- `docs/threat-models/` – STRIDE analyses for exposed interfaces (latest: `2026-07-25.md`).

## Governance alignment

The repo inherits `agent-governance/GOVERNANCE.md`. Expectations:

- Threat model any new network surface or data store; link the artifact from `DECISIONS.md`.
- Pin dependencies, commit lockfiles, and block releases on unresolved CVEs unless risk-accepted in writing.
- Generate SBOMs for backend + frontend builds before deployment.
- Keep README/ARCHITECTURE/SECURITY/THIRD_PARTY/DECISIONS current with every change.

Refer to `AGENTS.md` for the condensed playbook when opening new sessions.
