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

## 0017 – Live-debugging & deployment workflow (2026-08-24)
- **Status**: Accepted
- **Context**: The dashboard's real use case is a widescreen 1080p wall display on a live nanoclaw host. Iterating on the UI requires a tight loop so the user can inspect each change on the live box.
- **Decision**: Adopt a **fix → validate → push → deploy** loop. Validate with `pytest` + `npm run lint && npm run build && npm test`; commit with `[ai]` attribution; push to `main`; deploy on the host (host name/IP/folder are private — stored in the orchestrator's memory, not in this public repo) via `git pull origin main && docker compose up --build -d`.
- **Consequences**:
  - The host runs `NANOCLAW_ENABLED=true` (real data), so the tree renders the real agent hierarchy and channel traffic.
  - Only real human channels (whatsapp/matrix/etc.) route to the Human node; internal `channel:agent` routes to the orchestrator.
  - Documented in `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/OPENCODE_WORKFLOW.md`, and `README.md`.

## 0018 – V3 live-debugging refinements: hierarchy, human node, channel routing (2026-08-24)
- **Status**: Accepted
- **Context**: Live debugging on the nanoclaw host surfaced behaviors not covered by ADR 0016: the real topology emits no `tree`, so sub-agents rendered flat under the orchestrator; agent-to-agent traffic (`channel:agent`) was being drawn to the Human node; and the activity feed was noisy with signalling-only cards and repeated tool events.
- **Decision**:
  - Derive the tree hierarchy from `a2aEdges` via BFS from the orchestrator when no explicit `tree` is provided (agents that talk to the orchestrator are direct children; agents that only talk to a non-orchestrator agent become its sub-agents).
  - Make the human-facing agent sticky: set once from a real human channel (whatsapp/matrix/etc.), never moved by `channel:agent` traffic. Only real human channels route to the Human node; `channel:agent` routes to the orchestrator.
  - Reduce activity-feed noise: drop signalling-only `activity_update` cards (no `current_tool`) and collapse consecutive same-agent/same-tool activity into one card with a count.
- **Consequences**:
  - The tree reflects the real shallow hierarchy (orchestrator → agents → one sublevel) even without an explicit `tree` in the topology.
  - The Human node stays anchored above the human-facing agent regardless of agent-to-agent traffic.
  - The activity feed surfaces real signals instead of status noise.
  - All logic is pure and unit-tested (`deriveTreeFromEdges`, `channels`, `buildActivityFeed`).

## 0019 – WebSocket rejection close code + complete OpenAPI spec (2026-08-29)
- **Status**: Accepted
- **Context**: The `/ws/events` handler called `websocket.close(code=4003)` before `accept()`, so Starlette refused the handshake with HTTP 403 and the close code was never delivered — dead code. Separately, the auto-generated OpenAPI spec only covered `/health`; FastAPI omits WebSocket routes, so the service's primary endpoint was undocumented in the spec.
- **Decision**:
  - Accept the WebSocket first, then close with code `4003` for both rejection cases (disallowed origin, max clients reached), making the close code meaningful and machine-readable for clients.
  - Inject the `/ws/events` endpoint into the OpenAPI schema via a custom `app.openapi` override (documented as a `get` with a `101` response and `x-websocket: true`; full protocol in `API.md`).
- **Consequences**:
  - Clients observe a successful handshake followed by close code `4003` instead of HTTP 403; the frontend's generic `onclose` reconnect logic is unaffected.
  - `/openapi.json` now documents both endpoints; `API.md` remains the source of truth for WebSocket protocol details.
  - `schema_version` unchanged (no telemetry schema or transport change).

## 0020 – Live activity feed: timestamp ordering + timezone normalization (2026-09-02)
- **Status**: Accepted
- **Context**: On the live nanoclaw host, the "Live activity" feed (right column) showed a few entries pinned at the top that did not scroll down as new messages arrived, and those entries' timestamps were often in the future. Two root causes: (1) the feed was ordered by **arrival order** (backend emits bursts per poll cycle, so display order was inconsistent with the displayed times), and (2) nanoclaw stores timestamps as **naive local time** in several tables (`messages_out`, `delivered_at`, `status_changed`, `created_at`), which the dashboard treated as UTC — shifting them into the future.
- **Decision**:
  - Frontend: sort the activity feed by **timestamp descending** (newest first) in `buildActivityFeed`, so every entry lands on top and scrolls down as newer messages arrive, independent of backend emission order.
  - Backend: add `_normalize_timestamp()` to `NanoclawTelemetrySource` and apply it to all row-sourced timestamps. Naive values are interpreted as host-local time and converted to UTC; already-UTC ISO values (`messages_in`) are preserved.
- **Consequences**:
  - The feed is now consistently newest-on-top and scrolls down as new messages arrive.
  - Future timestamps no longer appear; naive local times are normalized to UTC before display.
  - `schema_version` unchanged (no telemetry schema or transport change); timestamp semantics are normalized at the source.
  - Covered by new unit tests: `buildActivityFeed` sorting (frontend) and `_normalize_timestamp` (backend).

## 0021 – Instance details screen: instance_info + config_snapshot events (2026-09-05)
- **Status**: Accepted
- **Context**: The wallboard shows live orchestration but nothing about the instance itself. The user asked for a deep-dive screen opened from the top-bar liveness indicator: instance details (version, uptime, resources, skills, models, agents, tools), a browseable view of the user/group configuration markdown files, and a live metrics bar (messages/errors, token buffer, time to reset, host). Nanoclaw has no HTTP API (admin surface is the `ncl` CLI over a Unix socket), so config must be read from the filesystem.
- **Decision**:
  - Add two periodic snapshot event types to the telemetry schema: `instance_info` (details + metrics, JSON-encoded in `payload.meta.instance`) and `config_snapshot` (grouped config files, JSON-encoded in `payload.meta.groups`) — following the existing `topology_snapshot` meta convention. Bump `schema_version` to `0.3.0`.
  - Mock source emits both periodically (~10/40 ticks) with realistic random-walk resources and synthetic markdown config groups (Agents, Skills, Workflow & Governance, Global/User).
  - Real nanoclaw source derives instance info from agent configs/sessions + host readings (`/proc/meminfo`, loadavg, `shutil.disk_usage`, best-effort) and collects config-relevant markdown only — the `groups/` subtree (agent instructions, memory, projects), the `container/` subtree (shared CLAUDE.md, skills, excluding `agent-runner` source), and root-level `*.md` (AGENTS.md, CLAUDE.md) — grouped by directory with the `groups/` prefix stripped from labels. The existing read-only bind mount (`NANOCLAW_HOST_DATA` → `/nanoclaw:ro`) already covers these — no new mount required. (Restricting the glob to config-relevant paths was added after live testing showed the 40-file cap was consumed by the product's own `src/`/`docs/` markdown before reaching the agent configs.)
- **Config browser is metadata-only + on-demand content.** Live testing showed ~425 markdown files across 15 agent groups (marvin = `dm-with-niels`, 100 files) — sending all content periodically was impractical. `config_snapshot` now carries the full folder tree with file metadata only (no content, no cap problem); the frontend fetches individual file contents on demand via a new `GET /api/config/file` endpoint (origin-validated, path-traversal-safe, `.md`-only, 20 KB cap). The browser renders folders collapsed (agent → projects/sub-divisions) and expands on click. Conversation logs are excluded.
  - Frontend: `instance_info`/`config_snapshot` are handled in the pure reducer (excluded from activity history, like `delivery_update`); the liveness indicator in `StatusStrip` becomes a button that opens a full-screen `InstanceDetails` overlay (header with back-to-dashboard, details row, collapsible config browser, resource sparkline strip). Uptime ticks locally every second; missing fields render as "—".
- **Consequences**:
  - The instance details screen updates in real time via the existing WebSocket stream; no new transport.
  - Config browsing works in mock mode (synthetic files) and real mode (actual nanoclaw config markdown); if the real source finds no markdown, the browser shows an empty state rather than breaking.
  - `schema_version` bumped to `0.3.0`; `frontend/src/lib/types.ts` mirrored; `API.md`, `README.md`, and `ARCHITECTURE.md` updated.
  - Covered by new tests: backend mock `instance_info`/`config_snapshot` structure, frontend reducer handling, StatusStrip click, and `InstanceDetails` rendering.
- **Amended 2026-09-05 (post-feedback rounds)**:
  - **Config-browser file context** — each file shows a role badge + description derived from its path (standing instructions, memory map/doctrine, composed CLAUDE.md, skills, projects, etc.) and OKF YAML frontmatter (`title`/`type`/`description`/`tags`) is parsed from memory concept files. Frontend-only (`configFileContext.ts`).
  - **Top-level folder labels** — the tree maps the raw directory names to canonical concepts per the nanoclaw docs: `groups` → **Agents** (one workspace per agent), `container` → **Shared runtime** (base image, agent-runner, skills), `root` → **Install root**, with wrapping descriptions.
  - **Main agent group surfaced** — the human-facing agent (sticky `humanAgentId` from real human channels) is mapped to its config folder via the `agent_groups.folder` column, now included per agent in `instance_info` (`folder` field — additive, no `schema_version` bump). The Agents folder expands by default and the main agent's folder is sorted to the top with a **Main** badge.
  - **Resource sparkline strip** — the bottom metrics bar (messages/errors already on the main dashboard; token-buffer/time-to-reset had no data source) was replaced with CPU/memory/disk sparklines fed by the periodic `instance_info` events (accumulated in the reducer, ~30 min window) plus host details, freeing vertical space for the config browser.
  - **CPU fix** — the real source's `cpuPercent` was computed from `os.getloadavg()` (a host-global run-queue length) and pegged at 100% on the busy host; now computed from `/proc/stat` jiffie deltas between polls (the `top` method).

## 0022 – GitHub discoverability polish: description, topics, social preview (2026-09-21)
- **Status**: Accepted
- **Context**: An organic-traffic audit flagged four repo-level discoverability issues: (1) the repo description ended with a double period and described the retired v2 orbit-canvas design; (2) the `nanoclaw` topic is self-referential with no existing audience; (3) the release feed appeared empty; (4) the OG social preview was GitHub's auto-generated gradient card.
- **Decision**:
  - Rewrote the repo description to describe the current product and target searchable keywords: *"Real-time telemetry dashboard for AI agent orchestrators — live WebSocket event stream, hierarchical tree visualization, and agent activity feed on a single 1080p screen."*
  - Replaced the `nanoclaw` topic with audience-bearing topics: `observability`, `monitoring`, `real-time`, `websocket-server`, `dashboard`, `visualization` (kept `ai-agents`, `fastapi`, `opencode`, `react`, `telemetry`, `typescript`, `web`).
  - Releases: verified already healthy — v1.3.1 latest (2026-09-06), tags pushed, `release.yml` green. No action needed; the audit was stale.
  - Social preview: generated `docs/social-preview.png` (1280×640, GitHub's recommended size) from the dashboard's design tokens (dark gradient, accent blue, pulse colors, Space Grotesk) with a stylized tree-graph motif. GitHub exposes no API for the social preview image, so upload is a one-time manual step via Settings → Social Preview.
- **Consequences**:
  - Repo now surfaces under active topic pages (observability, monitoring, real-time, websocket-server) instead of the self-referential `nanoclaw`.
  - Description is accurate to the current tree-graph product and keyword-rich for search.
  - Social preview requires a manual upload (no API path); the asset is versioned in-repo at `docs/social-preview.png`.
  - No code, schema, or dependency changes; no `schema_version` bump.

## 0023 – Dependabot batch: frontend dependency bumps (2026-09-21)
- **Status**: Accepted
- **Context**: Nine open dependabot PRs accumulated on the frontend. Six were independently green; three were coupled or conflicted and required coordinated handling.
- **Decision**:
  - Merged the six green bumps directly: oxlint 1.80.0→1.82.0, vite 8.2.2→8.3.0, @types/node 26.4.0→26.5.1, @heroui/styles 3.2.2→3.2.5, lucide-react 1.35.0→1.45.0, vitest 4.1.11→5.0.0.
  - React 19.2.8→19.3.0 (#68) and react-dom 19.2.8→19.3.0 (#65) are coupled — react and react-dom must match exactly. Merged react first, then rebased the react-dom branch onto the new main and merged. Both branches were conflict-resolved locally (lockfile regenerated via `npm install --package-lock`) and verified: lint 0 errors, build passes, 83/83 frontend tests pass.
  - @heroui/react 3.2.2→3.2.6 (#64) failed CI with an upstream peer conflict: `@heroui/react@3.2.6` requires peer `react-aria@^3.52.1`, but the old lockfile pinned `@adobe/react-spectrum@3.47.2` → `react-aria@3.50.0`. Fixed by regenerating the lockfile with a fresh resolution — `@adobe/react-spectrum@3.47.5` (latest in the `^3.47.0` range) pulls `react-aria@3.52.1`, satisfying the peer requirement. Verified locally before merge.
- **Consequences**:
  - All nine dependabot PRs merged; `main` is green (backend pytest + frontend lint/build/test all pass in CI).
  - `THIRD_PARTY.md` updated to the new versions (react/react-dom 19.3.0, vite 8.3.0, vitest 5.0.1, oxlint 1.83.0, lucide-react 1.47.0, @types/node 26.6.2, @types/react 19.3.0, @types/react-dom 19.3.0, @heroui/react 3.2.6, @heroui/styles 3.2.6).
  - No telemetry schema or transport change; no `schema_version` bump.
  - Note: the Heroui react-aria peer conflict is upstream (Heroui pins `@react-types/color@3.2.0` while requiring `react-aria@^3.52.1`); the fresh lockfile resolution works today but may recur on future Heroui bumps.

## 0024 – Backup / restore for nanoclaw config (2026-09-21)
- **Status**: Accepted
- **Context**: Operators need to clone a nanoclaw instance (fresh-host restore) and selectively import config (agents, wirings, users, orchestrator rules) into a running one. The dashboard mounts the nanoclaw data folder **read-only by design** (ADR 0006), so the dashboard backend can read state but must never write to it.
- **Decision**:
  - **Backup** runs in the dashboard backend: it reads the read-only mount, collects selected categories into a staging dir, and writes a `.tar.gz` archive plus a self-contained `restore.sh` into a **new writable `backups/` folder** inside the dashboard repo (mounted at `/backups` in Docker; the nanoclaw mount stays `:ro`).
  - **Restore** is executed by the host-side `restore.sh` (the user runs it on the nanoclaw host, where the data is writable and the service can be stopped). The script supports `plan` (dry-run), `restore` (full, stop→replace→restart→health-check), and `import` (partial, stop→apply→restart); it uses the nanoclaw checkout's `better-sqlite3` via an embedded Node helper, snapshots current state before applying, and never restores `data/upgrade-state.json`.
  - **Categories**: `full` (everything incl. raw `v2.db`), `agents` (all or specific ids), `orchestrator` (destinations + message policies + wirings/channels + orchestrator group), `channels`, `users`, `memory`, `tasks`, `env` (`.env`, **passphrase-encrypted** with openssl AES-256-CBC — required, never plaintext), `history` (opt-in session DBs).
  - **Conflict handling**: plan reports create/skip/overwrite/replace per item; default policy is skip-on-collision with an `--overwrite` flag; schema-version downgrade is refused.
  - **Out of scope**: the OneCLI Agent Vault (separate system; restore instructions document reconnecting it) and `~/.config/nanoclaw` allowlists (outside the mount; documented manual step).
  - **Live-validation refinements (2026-09-21, from the production host)**: agent group folders are dominated by working data — `work`/`repos`/`projects`/`conversations` (up to 6.8 GB per group, mostly git clones of remotes), `.pnpm-store` (~930 MB), and build caches (`.next`, `dist`, `build`, `.cache`). The `agents` category therefore backs up **configuration only**: instructions, memory, notes, and files under 10 MiB; working data and transient dirs are excluded (a future opt-in category could include them). The backend container runs as the host user (`NANOCLAW_UID`/`NANOCLAW_GID`) so `backups/` archives + restore scripts are owned by the operator, not root. The restore script probes for a node that can load the checkout's `better-sqlite3` (the nanoclaw service typically runs an nvm-managed Node whose ABI matches the pnpm-store binding; the system `node` often does not).
- **Consequences**:
  - New endpoints under `/api/backup` (status, create, list, download, plan, restore-script), all origin-validated like `/api/config/file`; `GET /status` returns 200 with `enabled: false` in mock mode, the rest return 503. An optional `NANOCLAW_BACKUP_TOKEN` shared secret (sent as `X-Backup-Token`) hardens the surface beyond the origin check.
  - New `NANOCLAW_BACKUP_DIR` setting + `backups/` mount in `docker-compose.yml`; `backups/` is gitignored (may contain encrypted secrets). The backend service runs as the host user via `NANOCLAW_UID`/`NANOCLAW_GID` so the operator can read/run the restore scripts.
  - No new Python/JS dependencies (stdlib + `openssl` binary, already present in `python:3.11-slim`).
  - No telemetry schema or transport change; no `schema_version` bump.
  - Threat model updated for the new read-only endpoints and the host-side restore script (see `docs/threat-models/2026-07-25.md`).
