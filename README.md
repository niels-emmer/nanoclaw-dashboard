# Nanoclaw Dashboard

Live, single-screen telemetry dashboard that shows the nanoclaw orchestrator delegating work to sub-agents. The backend (FastAPI) emits canonical events over WebSocket, and the frontend (Vite + React + TS) renders an animated flow-map tuned for 1080p displays with directional edge pulses for questions vs. responses.

## Stack at a glance

| Layer     | Tech                                                          | Notes |
|-----------|---------------------------------------------------------------|-------|
| Backend   | FastAPI + Uvicorn, structlog, Pydantic Settings               | Provides `/health` + `/ws/events` WebSocket streaming mock nanoclaw telemetry. |
| Frontend  | Vite + React + TypeScript                                     | Full-screen flow canvas, agent grid, event log, toggleable debug panel. |
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

Mock telemetry (`MockTelemetrySource`) emits alternating question/response pairs, seeded with deterministic agent names until the real nanoclaw feed is connected. Replace the source implementation but keep the schema versioned; document changes in `DECISIONS.md`.

## Layout + UX highlights

- Flow canvas keeps the orchestrator centered with sub-agents placed on a deterministic orbit; directional pulses animate question vs. response edges.
- Agent grid cards summarize last summary/state/timestamp for each agent.
- Event feed streams the latest eight events with timestamps.
- Debug panel (toggle at bottom) dumps the most recent raw event for troubleshooting.

Typography uses Space Grotesk + IBM Plex Sans, with an atmospheric gradient background tuned for 1080p displays. Avoid introducing new fonts/colors without updating the shared tokens in `src/index.css`.

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
