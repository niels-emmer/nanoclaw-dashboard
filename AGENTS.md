# Universal agent rules

> **Opencode Configuration**: This repository is self-contained for [Opencode](https://opencode.ai). Project config, subagents (`@explorer`, `@github`, `@reviewer`, `@security-auditor`), slash commands (`/plan`, `/handoff`, `/decision-log`), and skills live under `.opencode/`.
>
> **CRITICAL FOR OPENCODE SESSIONS**: Before doing any work, use the Read tool to load `docs/OPENCODE_WORKFLOW.md`. Follow everything in that file—it is the leading source of workflow/governance rules for OpenCode usage in this repo. After reading it, continue with the instructions in this `AGENTS.md` and any additional files it references.

These rules apply to every task in this tree unless overridden by a more
specific `CLAUDE.md` or `AGENTS.md`.

## Edit-time rules

1. **Think Before Coding** — State assumptions explicitly. If uncertain,
   ask rather than guess; stop and name what's unclear instead of guessing
   through it. Surface tradeoffs before proceeding.

2. **Simplicity First** — Write the minimum code that solves the problem.
   No features beyond what was asked, nothing speculative. If 200 lines
   could be 50, write the 50.

3. **Surgical Changes** — Touch only what the request requires. Match
   existing style even if you'd do it differently. No drive-by refactors
   or unrelated "improvements".

4. **Goal-Driven Execution** — Turn the task into machine-verifiable
   success criteria before writing code. Define what "done" looks like,
   then loop until those checks pass.

## Agent self-check rules

5. **Debugging Discipline** — Read the full error and stack trace before
   acting. Reproduce the problem before attempting a fix. Change one
   variable at a time. Beware confident wrong diagnosis: never generate a
   fix for a problem you have not confirmed.

6. **Reproduce Before Fixing** — Before fixing a bug, write a test that
   reliably reproduces it. Fix the code. Run the test. The bug is fixed
   only when the test passes — not when it "feels" fixed.

7. **Dependency Hygiene** — Treat every added package as permanent,
   uncontrolled code maintained on someone else's schedule. Ask whether
   the standard library handles it first. If you add a dependency,
   document the decision explicitly.

8. **Honest Communication** — Report actionable uncertainty, not vague
   reassurance. "I'm not sure this library supports streaming" is useful;
   "I think this should work" is not. Never dress up a guess as
   confidence.

9. **Recognize Failure Modes** — In autonomous loops no human reviews
   each step. Watch for and halt on the known traps: confident wrong
   diagnosis, fixes that only "feel" right, scope creep, silent guessing
   past confusion. Stop and flag rather than push through.

10. **Verify Before Done** — Nothing is complete until its success
    criteria are demonstrably met (tests run, output matches the goal).
    "Looks correct" is not "runs correctly". Close the loop with
    evidence.

# Project overview

Single-screen 1080p dashboard for the nanoclaw orchestrator delegating work
to sub-agents. Backend streams mock telemetry over WebSocket by default (no
nanoclaw install needed); frontend SPA renders the orbit canvas + agent/event
panes. Maintain: centered orchestrator, directional pulses (outward for
questions, inward for responses), 1080p-friendly layout.

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

## Visual + UX requirements

- Animate directional edges for questions vs responses; differentiate state
  changes (agent spin-up, in-flight, response) with motion + color.
- Purposeful typography (Space Grotesk + IBM Plex Sans, no default system
  stack), dark background with gradient, defined color story.
- Meaningful motion only—avoid noisy micro-animations.

# Governance & checklist

- Governance is normative: threat modeling, dependency pinning, SBOMs, ADRs,
  and documentation are mandatory.
- Keep all doc files current before merging: `README.md`, `docs/ARCHITECTURE.md`,
  `SECURITY.md`, `THIRD_PARTY.md`, `docs/DECISIONS.md`.
- Threat model every new network interface or data store; link from
  `docs/DECISIONS.md`. Current model: `docs/threat-models/2026-07-25.md`.
- When altering telemetry schema or transport: bump `schema_version`, update
  `frontend/src/lib/types.ts`, add ADR entry.
- **Prerequisites**: Node 20.19.0, Python 3.11+.
- **Before pushing**: `cd backend && pytest && cd ../frontend && npm run lint && npm run build`.
- **Lockfile discipline**: global `~/.npmrc` has `package-lock=false`. Always use
  `npm install --package-lock` (or `npm ci`) when updating frontend dependencies,
  otherwise `package-lock.json` won't be regenerated and CI will fail on `npm ci`.
- Keep `THIRD_PARTY.md` in sync with new deps (exact version + license).
- Prefer `./scripts/install_dashboard.sh` for provisioning; update it when
  workflows change.
- Wiki is auto-synced from `docs/` via `./scripts/sync_wiki.sh`; run it
  after changing `docs/ARCHITECTURE.md` or `docs/DECISIONS.md`.
- Container workflow: `docker compose up --build` reads `.env` defaults.
  Update Compose + nginx.conf if transport paths change.
- Nanoclaw host integration: read-only bind mount
  (`NANOCLAW_HOST_DATA` → `NANOCLAW_CONTAINER_DATA`),
  `NANOCLAW_ENABLED=true`. Never write to the mounted folder.
