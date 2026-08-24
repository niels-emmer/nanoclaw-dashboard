> **Opencode Configuration**: This repository is self-contained for [Opencode](https://opencode.ai). Project config, subagents (`@orchestrator`, `@general`, `@scout`, `@docs`), slash commands (`/start`, `/release`, `/decision-log`), and project-modified skills (`governance`) live under `.opencode/`. Generic subagents (`@explorer`, `@github`, `@reviewer`, `@security-auditor`), commands (`/plan`, `/handoff`), and universal skills come from your global `~/.config/opencode/` config.
>
> **CRITICAL FOR OPENCODE SESSIONS**: Run `/start` first — it prompts for task type and description, suggests a branch name, loads the governance skill, reads the workflow playbook, classifies data, and creates the branch. Follow everything in `docs/OPENCODE_WORKFLOW.md` — it is the leading source of workflow/governance rules for OpenCode usage in this repo. After reading it, continue with the instructions in this `AGENTS.md` and any additional files it references.
>
> If `/start` is unavailable, fall back to the manual sequence:
> 1. Ask the user for task type and description, then agree on a branch name.
> 2. Load the `governance` skill.
> 3. Read `docs/OPENCODE_WORKFLOW.md`.
> 4. Classify the data (default INTERNAL).
> 5. `git checkout -b <branch-name>`.

# Project overview

Single-screen **widescreen 1080p wall display** (TV via HDMI, Firefox) for the
nanoclaw orchestrator delegating work to sub-agents. Its purpose is to show
**"what's happening right now"** — to give people a feel for what nanoclaw,
orchestration, and multi-agent frameworks are about. Backend streams mock
telemetry over WebSocket by default (no nanoclaw install needed); frontend SPA
renders a **left-to-right hierarchical tree graph** (orchestrator root →
agents → sub-agents), a live activity feed, a compact agent roster, and a
status strip. Maintain: tree graph with the orchestrator at root, a **Human
node** above the human-facing agent (e.g. marvin), per-agent tool history
(active tool first, ghosted to the right), color-coded pulses, and a
glanceable 1080p layout.

## File layout at a glance

```
nanoclaw-dashboard/
├── backend/
│   ├── app/
│   │   ├── main.py               # FastAPI app factory, lifespan, /health + /ws/events
│   │   ├── config.py              # Pydantic settings (env prefix NANOCLAW_)
│   │   ├── events.py              # EventHub — broadcast + ring buffer flush to WS clients
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
│   │   ├── components/
│   │   │   ├── tree/              # TreeGraph, TreeNode, TreeEdge (left-to-right tree)
│   │   │   ├── ActivityFeed.tsx   # Simplified conversation stream
│   │   │   ├── AgentRoster.tsx    # Compact auto-hiding agent strip
│   │   │   ├── AgentDetail.tsx    # Click-to-expand drill-down panel
│   │   │   └── StatusStrip.tsx    # Top status bar (active/error/stuck/pending)
│   │   ├── hooks/useEventStream.ts  # Thin WS ingest + dispatch into reducer
│   │   ├── lib/
│   │   │   ├── eventReducer.ts    # Pure reducer (events, snapshots, edges, humanAgentId)
│   │   │   ├── treeLayout.ts      # Left-to-right tree layout (pure)
│   │   │   ├── treePaths.ts       # Edge/pulse path helpers (pure)
│   │   │   ├── channels.ts        # Human vs internal channel detection
│   │   │   ├── activityFeed.ts    # Feed filtering + collapse logic (pure)
│   │   │   ├── icons.ts           # Agent/tool icon keyword map
│   │   │   ├── types.ts           # Telemetry TS types (mirrors backend models.py)
│   │   │   ├── config.ts          # Backend URL resolution
│   │   │   └── utils.ts           # Snapshot/liveness/opacity derivation
│   │   ├── App.tsx / App.css / index.css  # 4-zone shell + design tokens
│   ├── Dockerfile
│   ├── nginx.conf                 # Proxies /ws/ to backend container
│   └── package.json
├── docs/
│   ├── ARCHITECTURE.md
│   ├── decision-log.md
│   ├── screenshot.png
│   └── threat-models/2026-07-25.md
├── scripts/install_dashboard.sh
├── .github/                       # Issue/PR templates, CODEOWNERS
├── docker-compose.yml
└── .env.example                   # Environment template (copy to .env)
```

## Defaults & port mappings

- Backend dev: `uvicorn app.main:app --reload --port 8000` → http://localhost:8000,
  health at /health
- Frontend dev: `npm run dev` (Vite) → http://localhost:5173, connects to
  `ws://localhost:8000/ws/events`
- Docker: backend on ${BACKEND_PORT:-8000}, frontend on ${FRONTEND_PORT:-4173},
  nginx proxies /ws/ → backend
- Mock telemetry is the default (NANOCLAW_ENABLED=false); no nanoclaw host needed.
- Override WebSocket endpoint: `VITE_BACKEND_WS_URL` env var.

## Live nanoclaw host

- The production host runs the stack in Docker with `NANOCLAW_ENABLED=true`
  (real data). Host name/IP/folder are private — stored in the orchestrator's
  memory, not in this public repo.
- Deploy: `git pull origin main && docker compose up --build -d` on the host.
  Frontend serves on :4173, backend on :8000.
- Live-debugging loop: **fix → validate (lint/build/test) → push to main →
  deploy to host** so the user can inspect changes on the live box.

## Visual + UX requirements

- Left-to-right tree graph with the orchestrator at root and sub-agents nested.
- **Human node** above the human-facing agent (sticky — set once from a real
  human channel, never moved by agent-to-agent traffic).
- Per-agent **tool history**: active tool first (color-coded round icon to the
  right of the blob), previously-used tools ghosted to the right.
- Color-coded pulses (question/response/activity) that follow the same path as
  the static edge; only real human channels (whatsapp/matrix/etc.) route to the
  Human node — internal `channel:agent` routes to the orchestrator.
- Purposeful typography (Space Grotesk + IBM Plex Sans, no default system
  stack), dark background with gradient, defined color story.
- Meaningful motion only—avoid noisy micro-animations.

# Governance & checklist

- Governance is normative: threat modeling, dependency pinning, SBOMs, ADRs,
  and documentation are mandatory.
- Keep all doc files current before merging: `README.md`, `docs/ARCHITECTURE.md`,
  `SECURITY.md`, `THIRD_PARTY.md`, `docs/decision-log.md`.
- Threat model every new network interface or data store; link from
  `docs/decision-log.md`. Current model: `docs/threat-models/2026-07-25.md`.
- When altering telemetry schema or transport: bump `schema_version`, update
  `frontend/src/lib/types.ts`, add ADR entry.
- **Prerequisites**: Node 20.19.0, Python 3.11+.
- **Before pushing**: `cd backend && pytest && cd ../frontend && npm run lint && npm run build && npm test`.
- **Lockfile discipline**: global `~/.npmrc` has `package-lock=false`. Always use
  `npm install --package-lock` (or `npm ci`) when updating frontend dependencies,
  otherwise `package-lock.json` won't be regenerated and CI will fail on `npm ci`.
- Keep `THIRD_PARTY.md` in sync with new deps (exact version + license).
- Prefer `./scripts/install_dashboard.sh` for provisioning; update it when
  workflows change.
- Wiki is auto-synced from `docs/` via `./scripts/sync_wiki.sh`; run it
  after changing `docs/ARCHITECTURE.md` or `docs/decision-log.md`.
- Container workflow: `docker compose up --build` reads `.env` defaults.
  Update Compose + nginx.conf if transport paths change.
- Nanoclaw host integration: read-only bind mount
  (`NANOCLAW_HOST_DATA` → `NANOCLAW_CONTAINER_DATA`),
  `NANOCLAW_ENABLED=true`. Never write to the mounted folder.
