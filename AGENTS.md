# Mission-critical context
- Product requirement: single-screen dashboard for the nanoclaw orchestrator delegating work to sub-agents with live animation of questions/responses.
- Backend already streams mock telemetry over WebSocket; frontend SPA renders the orbit canvas + agent/event panes. Maintain that experience (centered orchestrator, directional pulses, 1080p-friendly layout).

# Governance + Required Docs
- Governance is normative: threat modeling, dependency pinning, SBOMs, ADRs, and documentation are mandatory.
- Keep `README.md`, `docs/ARCHITECTURE.md`, `SECURITY.md`, `THIRD_PARTY.md`, and `docs/DECISIONS.md` up to date before merging.
- Threat model every new network interface or data store and link the artifact in `docs/DECISIONS.md`.
- Current threat model: `docs/threat-models/2026-07-25.md` (WebSocket surface). Update it or add a new entry when interfaces change.

# Architecture expectations
- Backend: FastAPI + WebSocket `/ws/events`, `TelemetrySource` abstraction, structlog JSON logging, pytest coverage. Swap in the real nanoclaw feed by implementing a new source + ADR.
- Frontend: Vite + React + TypeScript, custom SVG orbit renderer, dedicated `useEventStream` hook for ingest/retry logic, toggleable debug pane. Typography tokens live in `frontend/src/index.css`.
- Layout stays optimized for a bezel-less 1080p TV: gradients, purposeful typography, minimal chrome.

# Visual + UX requirements
- Animate directional edges for questions vs responses; differentiate state changes (agent spin-up, in-flight, response) with motion + color.
- Purposeful typography (no default system stack), defined color story (avoid purple-on-white fallback), and atmospheric background (gradient/pattern) per repo guidance.
- Meaningful motion only—avoid noisy micro-animations.

# Implementation checklist
- Use Node **20.19.0** (Vite/Rolldown requirement) and Python **3.11+**. Update the docs if versions change.
- Before pushing changes: `cd backend && pytest` and `PATH=$PWD/.tools/node/bin:$PATH && cd frontend && npm run build`.
- When altering telemetry schema or transport, bump `schema_version`, update frontend types, and add an ADR entry.
- Keep `THIRD_PARTY.md` in sync with any new dependencies (exact version + license) and note modifications.
- Add/extend threat models for new interfaces, then reference them from `docs/DECISIONS.md`.
- Document any new commands or operational steps in `README.md` + `docs/ARCHITECTURE.md` immediately.
- Prefer using `./scripts/install_dashboard.sh` to provision deps + run verification; update the script whenever workflows change.
- Container workflow: `docker compose up --build` reads `.env` defaults (ports + backend config). Update Compose + nginx proxy if you change transport paths.
- When wiring to a real Nanoclaw host, require a read-only bind mount of the Nanoclaw checkout (`NANOCLAW_HOST_DATA` → `NANOCLAW_CONTAINER_DATA`) and set `NANOCLAW_ENABLED=true`. Never write to the mounted data folder.
