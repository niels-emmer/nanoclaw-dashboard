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

## 0013 – Agent team expansion and post-completion workflow (2026-08-02)
- **Status**: Accepted
- **Context**: The agent team had gaps: no explicit `@general` config, no dependency research agent, no documentation audit agent. The orchestrator's workflow stopped at handoff without automatic post-completion maintenance, causing docs to drift from code. A free-tier model was nearly selected for the explorer agent, revealing a governance gap.
- **Decision**: 
  - Added 3 new subagents: `@general` (multi-step tasks, edit: ask), `@scout` (dependency/CVE research, read-only), `@docs` (documentation audit, read-only)
  - Added color configs to all agents for UI scannability
  - Bumped `subagent_depth` from 2 to 3 for deeper delegation chains
  - Bumped `github` steps from 40 to 50, added `steps: 25` to reviewer
  - Added post-completion maintenance step (step 8) to orchestrator workflow: auto-audits docs, updates README, syncs governance, records decisions after every milestone
  - Added explicit "no free-tier models" rule to governance skill, OPENCODE_WORKFLOW.md, AGENTS.md, and orchestrator rules
  - Consolidated duplicate mandatory startup instructions (removed from orchestrator.md, kept in .opencode/AGENTS.md)
- **Consequences**:
  - Docs stay in sync with code automatically after each milestone
  - Governance gaps are captured and baked into docs immediately
  - Free-tier model prohibition is enforced at 4 independent layers
  - New contributors get a richer agent team out of the box
  - R7 resolved: explorer uses `opencode/gpt-5.4-nano` — a lighter, zero-retention Zen-hosted model suitable for read-only file searches

## 0015 – V2 frontend rearchitecture (2026-08-24)
- **Status**: Accepted
- **Context**: The frontend works but is hard to extend: `FlowCanvas` is a 600-line monolith, `useEventStream` mixes WebSocket ingest with state derivation, design tokens are split across `index.css` and HeroUI's theme, and there is zero frontend test coverage. A v2 is planned to make the codebase maintainable and testable without changing the visual identity or the telemetry contract.
- **Decision**: Rebuild the frontend architecture in six phases: (1) dead-code cleanup + polish, (2) consolidate design tokens into one explicit layer, (3) extract pure derivation logic out of `useEventStream` into a testable reducer, (4) decompose `FlowCanvas` into focused components, (5) add Vitest coverage for pure logic, (6) verify + update docs. Full plan in `docs/v2-plan.md`.
- **Consequences**:
  - No backend or schema changes; `schema_version` stays `0.2.0`.
  - Frontend becomes testable and cheaper to extend for v3+ features (drill-downs, timelines, sparklines).
  - Vitest + `@testing-library/react` added as dev-only dependencies; `THIRD_PARTY.md` updated accordingly.
  - Visual identity preserved; verified against `docs/screenshot.png` after token consolidation and canvas decomposition.
  - **Completed 2026-08-24**: all six phases merged. `FlowCanvas` decomposed into `canvas/` sub-components; derivation moved to a pure `eventReducer`; design tokens single-sourced in `index.css`; Vitest suite added (26 tests) with a `test-frontend` CI job. Also fixed a pre-existing flaky backend test (`test_mock_source_generates_question_and_response`) that assumed the first mock event was always a question.

## 0016 – V3 live orchestration wallboard (2026-08-24)
- **Status**: Accepted
- **Context**: The v2 dashboard worked but was not suited to its real use case: a widescreen 1080p wall display (TV via HDMI, Firefox) whose purpose is to show "what's happening right now" for a multi-agent framework demo. Pain points: the orbit/star canvas was mostly empty and misrepresented the actual tree/spoke communication; the tool indicator was illegible; the agents panel was 25% static; and the most active element (the event feed) was the smallest.
- **Decision**: Overhaul the UI into a four-zone "live orchestration" wallboard: a left-to-right hierarchical tree graph (orchestrator root, sub-agents nested), a promoted live activity feed, a compact auto-hiding agent roster, a click-to-expand agent detail panel, and a top status strip with error/stuck/pending alerts. Colorful showcase styling (ambient gradient, color-coded pulses, glowing active nodes, per-agent tool history). Backend mock source extended with `route-planner` + 2 sub-agents and a `tree` field in the topology snapshot to drive the hierarchy.
- **Consequences**:
  - The tree layout reflects the real shallow hierarchy (orchestrator → agents → one sublevel) instead of a forced star.
  - Tool visibility improved: active tool first, previously-used tools ghosted to the right, color-coded by category.
  - The layout is tuned for widescreen 1080p; smaller windows degrade gracefully via responsive CSS.
  - Backend schema unchanged (`schema_version` stays `0.2.0`); the `tree` field is additive metadata in the topology snapshot.
  - Frontend remains testable: `computeTreeLayout` is pure and covered by non-overlap + hierarchy tests.

## 0014 – OpenCode config consolidation: global vs repo split (2026-08-02)
- **Status**: Accepted
- **Context**: OpenCode config was duplicated across global (`~/.config/opencode/`) and repo (`.opencode/`). The 16 universal coding rules existed in 3 places. Skills, agents, and commands were duplicated with subtle divergences. The decision-log target path differed between global (`docs/decision-log.md`) and repo (`docs/DECISIONS.md`). The global config used deprecated singular directory names (`agent/`, `command/`, `skill/`).
- **Decision**:
  - Renamed `docs/DECISIONS.md` → `docs/decision-log.md` (align with global convention)
  - Moved universal 16 coding rules to global `~/.config/opencode/AGENTS.md` only; removed from repo root `AGENTS.md` and `.opencode/AGENTS.md`
  - Moved generic agents (explorer, github, reviewer, security-auditor) to global `agents/` only
  - Moved generic commands (handoff, plan) to global `commands/` only
  - Moved universal skills (code-standards, test-patterns, etc.) to global `skills/` only; kept project-modified `governance` skill in repo
  - Renamed global directories to plural (`agents/`, `commands/`, `skills/`)
  - Consolidated global config variants: promoted `.clean` profile to active `opencode.json`, removed `.omo` (oh-my-openagent) and `.jsonc`
  - Updated wiki sync script to map `decision-log.md` → `Decision-Log.md`
- **Consequences**:
  - Universal rules live once in global — every project inherits them
  - Repo is self-contained for project-specific behavior (orchestrator, start/release commands, governance skill)
  - New projects in empty folders inherit global agents, commands, and skills automatically
  - No duplicated config to maintain across global and repo
  - Wiki page renamed from `Decisions` to `Decision-Log`
