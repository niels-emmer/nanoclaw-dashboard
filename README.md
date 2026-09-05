# Nanoclaw Dashboard

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python 3.11+](https://img.shields.io/badge/Python-3.11%2B-blue?logo=python)](backend/pyproject.toml)
[![Node 20.19.0](https://img.shields.io/badge/Node-20.19.0-blue?logo=node.js)](frontend/package.json)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

Live, single-screen telemetry dashboard for **nanoclaw**, an AI agent
orchestrator. Watch the orchestrator delegate work to sub-agents in real
time — questions pulse outward, responses flow back — all on a single
1080p display.

<p align="center">
  <a href="docs/screenshot.png" target="_blank">
    <img src="docs/screenshot.png" alt="Nanoclaw Dashboard screenshot"
         width="720" style="border-radius: 8px" />
  </a>
  <br />
  <em>Tree graph, live activity feed, and agent roster — everything fits on one screen.</em>
</p>

## Features

- **Hierarchical tree graph** — left-to-right tree with the orchestrator at
  root and sub-agents nested, animated color-coded pulses (questions →
  agents, responses ← agents), glowing active agents, and per-agent tool
  history (active tool first, previously-used tools ghosted to the right)
- **Live activity feed** — simplified conversation stream of messages and
  tool calls, with errors highlighted
- **Compact agent roster** — one-line agent chips that auto-hide when idle
- **Agent drill-down** — click any agent to inspect its state, model, current
  tool, skills, and recent activity
- **Status strip** — orchestrator, connection, active/error/stuck/pending
  counts at a glance
- **Mock mode out of the box** — works immediately without nanoclaw installed
- **Real nanoclaw integration** — read-only tail of the nanoclaw SQLite
  database for live production data
- **Docker support** — one `docker compose up` for the full stack

## Table of Contents

- [Quick Start](#quick-start)
- [Manual Setup](#manual-setup)
- [Docker](#docker)
- [Connect to a Real Nanoclaw Host](#connect-to-a-real-nanoclaw-host)
- [Debugging](#debugging)
- [Project Structure](#project-structure)
- [Opencode Integration](#opencode-integration)
- [Documentation Map](#documentation-map)
- [Contributing](#contributing)
- [License](#license)
- [Security](#security)

## Quick Start

The fastest way to get running:

```bash
./scripts/install_dashboard.sh
```

This single script:
1. Creates a Python virtual environment (`.venv`)
2. Installs backend dependencies
3. Downloads Node **20.19.0** into `.tools/node`
4. Installs frontend dependencies
5. Runs backend tests, frontend lint, and frontend build

When it finishes, start the dev servers in **two terminals**:

```bash
# Terminal 1 — Backend (FastAPI WebSocket server)
source .venv/bin/activate
cd backend
uvicorn app.main:app --reload --port 8000

# Terminal 2 — Frontend (Vite dev server)
PATH=$PWD/.tools/node/bin:$PATH
cd frontend
npm run dev
```

Then open **http://localhost:5173** in your browser. The dashboard connects
to `ws://localhost:8000/ws/events` and starts displaying mock telemetry
immediately.

## Manual Setup

If you prefer to set up manually or can't run the install script:

```bash
# Backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
cd backend && pytest && uvicorn app.main:app --reload --port 8000

# Frontend (separate terminal, requires Node 20.19.0)
npm --prefix frontend install
npm --prefix frontend run dev
```

### Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Python | 3.11+ | Uses newer typing + Pydantic v2 |
| Node.js | 20.19.0 | Vite 8 + rolldown require this exact version |
| OS | macOS / Linux | Tested on macOS Ventura+ and Ubuntu 24.04 |

> **Node version**: If you don't have Node 20.19.0, the install script
> downloads it automatically to `.tools/node`. You can also use
> [nvm](https://github.com/nvm-sh/nvm):
> ```bash
> nvm install 20.19.0 && nvm use 20.19.0
> ```

## Docker

For a containerized setup that doesn't require any local tooling:

```bash
docker compose up --build
```

- Frontend: **http://localhost:4173**
- Backend health: **http://localhost:8000/health**
- Backend API docs: **`API.md`** (endpoints, WebSocket protocol, event schema) — live OpenAPI spec at `http://localhost:8000/openapi.json`

The frontend container serves the production build via nginx and proxies
WebSocket traffic to the backend automatically. Adjust ports in `.env` (copy from `.env.example`).

## Connect to a Real Nanoclaw Host

By default, the dashboard uses mock telemetry. To connect to a live nanoclaw
instance:

1. Create `.env` from `.env.example` and update settings:
   ```ini
   NANOCLAW_ENABLED=true
   NANOCLAW_HOST_DATA=/absolute/path/to/your/nanoclaw/checkout
   ```
2. Restart the backend:
   ```bash
   docker compose up --build backend   # Docker
   # or
   source .venv/bin/activate && cd backend && uvicorn app.main:app --reload --port 8000
   ```

The backend mounts the nanoclaw data folder **read-only** and tails the
SQLite databases (`data/v2.db`, per-session `inbound.db`/`outbound.db`)
for live events. If the mount is missing or unreadable, it falls back to
mock telemetry automatically.

## Deploy to a Live Host

To run the dashboard against a live nanoclaw instance (real data), deploy the
stack on the host with `NANOCLAW_ENABLED=true`:

```bash
# on the host
cd <repo>
git pull origin main
docker compose up --build -d
```

Frontend serves on `:4173`, backend on `:8000`. The live-debugging loop is
**fix → validate (lint/build/test) → push to main → deploy to host**.

## Debugging

### Backend isn't starting

- Check that port 8000 isn't already in use: `lsof -i :8000`
- Verify your Python version: `python3 --version` (needs 3.11+)
- Run tests to isolate issues: `cd backend && pytest -v`

### Frontend shows blank screen or "Connection failed"

- Is the backend running? Check `http://localhost:8000/health`
- Is the WebSocket endpoint correct? The frontend looks for
  `ws://localhost:8000/ws/events`. Override with:
  ```bash
  VITE_BACKEND_WS_URL=ws://myhost:8000/ws/events npm run dev
  ```
- Check the browser's developer console for WebSocket errors

### Nothing appears on the tree graph

- With mock telemetry (default), events appear after ~1 second
- If you're using nanoclaw integration, verify `NANOCLAW_ENABLED=true` and
  the data path exists
- Check the backend logs for errors:
  ```bash
  source .venv/bin/activate && cd backend && uvicorn app.main:app --reload --port 8000 --log-level debug
  ```

### Docker issues

- Rebuild after changing environment variables:
  ```bash
  docker compose build --no-cache
  ```
- Check container logs: `docker compose logs -f backend` or `frontend`
- Ensure no other services are using ports 8000 or 4173

## Project Structure

```
nanoclaw-dashboard/
├── opencode.json               # Portable Opencode workspace configuration
├── .opencode/                  # Project-specific OpenCode config (global provides universal rules)
│   ├── AGENTS.md               # Mandatory startup ritual
│   ├── agents/                 # Project-specific subagents (@orchestrator, @general, @scout, @docs)
│   ├── commands/               # Project-specific commands (/start, /release, /decision-log)
│   └── skills/                 # Project-modified skill (governance)
├── backend/                    # FastAPI WebSocket server
│   ├── app/
│   │   ├── main.py             # App factory, lifespan, routes
│   │   ├── config.py           # Pydantic settings (env-driven)
│   │   ├── events.py           # EventHub — broadcast + ring buffer flush to WS clients
│   │   ├── logging.py          # structlog JSON configuration
│   │   ├── cli.py              # CLI entry point
│   │   └── telemetry/
│   │       ├── models.py       # Canonical event schema
│   │       ├── source.py       # TelemetrySource interface + MockTelemetrySource
│   │       └── nanoclaw.py     # NanoclawTelemetrySource (live data)
│   ├── tests/
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/                   # Vite + React + TypeScript SPA
│   ├── src/
│   │   ├── components/
│   │   │   ├── tree/           # TreeGraph, TreeNode, TreeEdge (left-to-right tree)
│   │   │   ├── ActivityFeed.tsx  # Simplified conversation stream
│   │   │   ├── AgentRoster.tsx   # Compact auto-hiding agent strip
│   │   │   ├── AgentDetail.tsx   # Click-to-expand drill-down panel
│   │   │   ├── InstanceDetails.tsx # Full-screen instance details overlay
│   │   │   └── StatusStrip.tsx   # Top status bar (click liveness → details)
│   │   ├── hooks/
│   │   │   └── useEventStream.ts  # Thin WS ingest + dispatch into reducer
│   │   ├── lib/
│   │   │   ├── eventReducer.ts  # Pure reducer (events, snapshots, edges, humanAgentId)
│   │   │   ├── treeLayout.ts    # Left-to-right tree layout (pure)
│   │   │   ├── treePaths.ts     # Edge/pulse path helpers (pure)
│   │   │   ├── channels.ts      # Human vs internal channel detection
│   │   │   ├── activityFeed.ts  # Feed filtering + collapse logic (pure)
│   │   │   ├── icons.ts         # Agent/tool icon keyword map
│   │   │   ├── types.ts         # Telemetry types (mirrors backend)
│   │   │   ├── config.ts        # Backend URL resolution
│   │   │   └── utils.ts         # Snapshot/liveness/opacity derivation
│   │   ├── App.tsx
│   │   ├── App.css
│   │   └── index.css           # Design tokens (colors + typography)
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
├── docs/
│   ├── ARCHITECTURE.md
│   ├── decision-log.md
│   ├── OPENCODE_WORKFLOW.md    # OpenCode session governance playbook
│   ├── screenshot.png
│   └── threat-models/          # STRIDE analyses
├── scripts/
│   ├── install_dashboard.sh    # One-shot setup script
│   ├── sync_wiki.sh            # Sync docs/ → GitHub Wiki
│   └── repo_id.sh              # Resolve GitHub owner/repo identifier
├── .github/
│   ├── CODEOWNERS
│   ├── dependabot.yml          # Automated dependency updates
│   ├── pull_request_template.md
│   ├── ISSUE_TEMPLATE/
│   └── workflows/
│       ├── ci.yml              # Test + build on PR/push to main
│       ├── release.yml         # Auto-create GitHub release on v* tag
│       └── security.yml        # Security scanning CI
├── CHANGELOG.md                # Release history
├── docker-compose.yml
├── .env.example                # Environment template (copy to .env)
├── LICENSE
├── README.md
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
├── SECURITY.md
├── THIRD_PARTY.md
└── AGENTS.md                   # Agentic coding checklist
```

## Opencode Integration

This repository is self-contained for [Opencode](https://opencode.ai). Opening an Opencode session in this repository automatically loads the following from `opencode.json` and `.opencode/`:

- **Primary Orchestrator**: Default coordinator agent (`orchestrator`) that manages general coding, planning, and delegation. After every implementation milestone, it automatically runs post-completion maintenance: auditing docs, updating README, recording decisions, and syncing governance docs.
- **Subagents**: Project-specific subagents in `.opencode/agents/` (`@orchestrator`, `@general`, `@scout`, `@docs`). Generic subagents (`@explorer`, `@github`, `@reviewer`, `@security-auditor`) come from your global `~/.config/opencode/agents/`.
- **Slash Commands**: Project-specific commands in `.opencode/commands/` (`/start`, `/release`, `/decision-log`). Generic commands (`/plan`, `/handoff`) come from your global `~/.config/opencode/commands/`.
- **Embedded Skills**: Project-modified skill in `.opencode/skills/` (`governance`). Universal skills (`code-standards`, `test-patterns`, etc.) come from your global `~/.config/opencode/skills/`.
- **Instructions**: Project overview and workflow rules in `AGENTS.md` and `docs/OPENCODE_WORKFLOW.md`. Universal coding rules come from your global `~/.config/opencode/AGENTS.md`.

### Configuration defaults (`opencode.json`)

| Setting | Value | Purpose |
|---------|-------|---------|
| `default_agent` | `orchestrator` | Sets the orchestrator as the primary session agent |
| `model` | `opencode/deepseek-v4-flash` | Default model for all agents (each agent can override) |
| `subagent_depth` | `3` | Allows subagents (e.g., `@github`) to spawn helpers for multi-step operations |
| `share` | `manual` | Prevents automatic session sharing; explicit opt-in required |
| `instructions` | `AGENTS.md`, `docs/OPENCODE_WORKFLOW.md` | Auto-loaded governance and workflow rules |
| `skills.paths` | `.opencode/skills` | Scans the project skill directory for available skills |

Every GitHub user opening this project gets the same pinned defaults. No provider gating is enforced — users can override the model or provider in their local `~/.config/opencode/opencode.json` if needed.

### ⚠️ Session startup: mandatory `/start` command

Every new OpenCode session **must** begin with the `/start` command. It loads the `governance` skill, reads `docs/OPENCODE_WORKFLOW.md`, classifies the data (defaults to INTERNAL), and reports readiness — all in one step.

If `/start` is unavailable (e.g., fresh clone before the command is registered), use this fallback prompt as your first message:

> **"Execute the mandatory startup steps now"**

This forces the agent to manually load the `governance` skill and read `docs/OPENCODE_WORKFLOW.md` before any work begins.

## Documentation Map

| Location | Purpose |
|----------|---------|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design, data flow, component responsibilities |
| [CONTRIBUTING.md](CONTRIBUTING.md) | How to contribute — setup, guidelines, PR process |
| [SECURITY.md](SECURITY.md) | Security controls, threat models, vulnerability reporting |
| [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) | Community standards |
| [THIRD_PARTY.md](THIRD_PARTY.md) | Dependency provenance ledger (exact versions + licenses) |
| [docs/decision-log.md](docs/decision-log.md) | Architecture Decision Record (ADR) log |
| [docs/threat-models/](docs/threat-models/) | STRIDE analyses for exposed interfaces |
| [AGENTS.md](AGENTS.md) | Project overview, layout, and build/test commands |
| [frontend/README.md](frontend/README.md) | Frontend-specific development notes |
| [Wiki](https://github.com/niels-emmer/nanoclaw-dashboard/wiki) | Rendered docs (auto-synced from `docs/`) |

## Wiki

The [project wiki](https://github.com/niels-emmer/nanoclaw-dashboard/wiki) is
automatically synced from the `docs/` folder. To update it:

1. Create the first wiki page through the GitHub web UI to initialize the
   wiki repository.
2. Run `./scripts/sync_wiki.sh` to mirror `docs/` into the wiki.

Do not edit wiki pages directly — edit the source Markdown files in `docs/`
and re-run the sync script.

## Telemetry Schema

The canonical event format (defined in `backend/app/telemetry/models.py`,
mirrored in `frontend/src/lib/types.ts`):

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2026-07-26T12:34:56.789Z",
  "type": "question | response | agent_status | activity_update | delivery_update | approval_pending | topology_snapshot | instance_info | config_snapshot",
  "source": "orchestrator | agent:<name> | channel:<type>",
  "target": "agent:<name> | orchestrator | admin | dashboard",
  "payload": {
    "summary": "Delegating research task to seer",
    "duration_ms": 1200,
    "status": "running | completed | error | pending | processing | delivered | failed",
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
  "schema_version": "0.3.0"
}
```

`instance_info` and `config_snapshot` are periodic snapshot events that power
the **Nanoclaw Instance details** screen (click the liveness indicator in the
top-right of the status bar): instance version/uptime/resources/skills/models/
agents/tools, the user/group configuration markdown files (browseable in a
two-pane viewer), and live metrics (messages/errors, token buffer, time to
reset, host details). Their structured payloads are JSON-encoded in
`payload.meta` (`meta.instance` and `meta.groups`) — see `API.md` for the full
shape.

## Contributing

We welcome contributions! Please read:

- [CONTRIBUTING.md](CONTRIBUTING.md) — setup, guidelines, PR process
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) — community standards

Check the [issue tracker](https://github.com/niels-emmer/nanoclaw-dashboard/issues)
for open issues. For major changes, open an issue or discussion first to
discuss what you'd like to change.

## License

This project is licensed under the MIT License — see [LICENSE](LICENSE).

## Security

Found a vulnerability? See [SECURITY.md](SECURITY.md) for our disclosure
process. Do **not** open public issues for security vulnerabilities.
