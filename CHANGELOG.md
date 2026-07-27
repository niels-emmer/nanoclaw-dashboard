# Changelog

## [1.0.0] — 2026-07-27

### Added

- **Live agent ops data pipeline** — backend reads 6 additional operational tables from Nanoclaw databases (`container_configs`, `container_state`, `processing_ack`, `delivered`, `pending_approvals`, `messaging_group_agents`, `agent_destinations`) plus `.heartbeat` file for container liveness. Adds 4 new event types (`activity_update`, `delivery_update`, `approval_pending`, `topology_snapshot`) and 12 new payload fields. (#7e1ffe7)
- **Tool indicator rings on orbit canvas** — color-coded arcs (executing=red, reading=blue, writing=amber, network=cyan, thinking=purple) show real-time tool activity per agent. (#b231ccc)
- **Liveness dots** — green/alive, yellow/stale, red/dead indicators on canvas nodes and agent cards. (#b231ccc, #f368a48)
- **Skills dots** — small dots below agent labels on canvas showing loaded skill count. (#b231ccc)
- **Hover tooltips on canvas** — agent name, state, current tool, uptime on hover. (#b231ccc)
- **Click-to-filter on canvas** — click an agent to highlight its edges and dim others. (#b231ccc)
- **Agent activity line in grid** — shows current tool name, elapsed time, and last summary for active agents. (#f368a48)
- **Model/provider badges** — per-agent chip showing provider/model (e.g., `claude/sonnet`). (#f368a48)
- **Delivery status indicators** — delivery_update events with delivered/failed/pending icons in event feed. (#f368a48)
- **Approval pending tracking** — approval_pending events with action badges in event feed and agent cards. (#f368a48)
- **Topology snapshots** — routing graph with channel nodes on outer ring and agent-to-agent edges. (#7e1ffe7)
- **Chat bubbles on orbit canvas** — transient bubbles showing question/response summaries near the target agent, auto-dismiss after 5 seconds. (#feadb47)
- **Agent activity rings** — pulsing rings around agents on the canvas during activity. (#e5cdf7c)
- **Orchestrator busy ring** — amber ring around the orchestrator node when agents are in flight. (#5cd0ce7)
- **Color-coded agent name chips and event type badges** — each agent and event type gets a deterministic color. (#d4b8925)
- **TO/FR tracking in agent cards** — per-agent lists of outbound targets and inbound sources with color-coded blobs. (#fc61ba9)
- **Event type prefix and direction arrows** in agent cards. (#fc61ba9)
- **Nanoclaw telemetry integration** — read-only tail of Nanoclaw SQLite databases for live production data. (#bfeeb1c)
- **Docker Compose deployment** — one-command stack with nginx proxy for same-origin WebSocket. (#40970f7)
- **Install script** — `scripts/install_dashboard.sh` for one-shot provisioning. (#6259a2e)
- **CI security scanning** — `pip-audit`, `npm audit`, and TruffleHog secret scanning in GitHub Actions. (#8307e23)
- **Dependabot** — automated weekly dependency updates for npm and pip. (#d957648)
- **GitHub Wiki sync** — `scripts/sync_wiki.sh` mirrors `docs/` to the project wiki. (#5d914f5)
- **CSP headers** — Content Security Policy on backend responses. (#8307e23)
- **Threat model** — STRIDE analysis for WebSocket + Nanoclaw filesystem surface. (#8307e23)

### Changed

- **UI redesign** — pure black background, purple accent orbit, compact hero with side-by-side right panels, full-width 1080p layout. (#89fc4c3, #4989be9, #5cf236b, #38bb555)
- **Migrated to HeroUI v3 + Tailwind CSS v4** — replaced custom components with HeroUI Card/Chip/Typography. (#70d5d1b)
- **Agent graph visual redesign** — Lucide SVG icons, white borders, dashed edges, circumference-based line routing. (#cc7a22f, #d7df664)
- **Chat bubble styling** — matched to agent circle border style, 80% size, reduced transparency, larger fonts. (#2e5bf3f, #261b5f1, #3c7b986, #ae9fc47)
- **Agent cards simplified** — removed activity/last-event line, moved liveness dot after name for left-alignment. (#4a2111a)
- **Event feed filtered** — `delivery_update` and `activity_update` events removed from display (internal bookkeeping, not user-facing). (#4a6d631, #b73ffea)
- **Chat bubbles restricted** — only `question` and `response` events spawn bubbles; system messages filtered out. (#0f15f4e)
- **Dashboard title** — updated to "NanoClaw Live Traffic". (#f9bfc93)
- **Canvas layout** — fills available vertical space, increased channel node orbit spacing, moved agent icon and skills dots below label. (#a165662, #3fa8c1f, #898d1fd)
- **Mock telemetry** — aligned agent names with model/skills maps, emits all new event types for frontend dev without Nanoclaw. (#e99f014)
- **Schema version** — bumped from `0.1.0` to `0.2.0`. (#7e1ffe7)

### Fixed

- **Agent card blob colors** — TO/FR/RESPONSE blobs now color by referenced agent, not the source agent. (#7e576fc)
- **Canvas tool arc animation** — uses `stroke-dashoffset` for smooth growth instead of abrupt jumps. (#24dddd2)
- **Backend agent_state** — set to `IDLE` on response events. (#990ba38)
- **Nanoclaw source startup** — emits initial `agent_status` events so frontend sees agents immediately. (#065b755)
- **Nanoclaw poll loop** — initial events moved into poll loop so clients receive them on connect. (#506eb8c)
- **UnboundLocalError** — fixed `container_status` variable in `_collect_activity_events`. (#42acde9)
- **SQLite row access** — converted `sqlite3.Row` to dict for `.get()` compatibility. (#56576be)
- **Approval dedup** — deduplicate approval events with time cutoff. (#55402f2)
- **CLI noise filtering** — also filter CLI noise from `approval_pending` events. (#e91a6d5)
- **Chat bubble filtering** — only show bubbles for question/response events. (#0f15f4e)
- **Agent icon lookup** — robust matching via nodeId + label, keyword-based semantic matching. (#8a8786e, #b71e1f0)
- **Logging** — `setup_logging()` called once at module level instead of on every `get_logger()` call. (#e95bf59)
- **CI** — updated TruffleHog action from `@v3` to `@main`. (#fe3b6e0)
- **Docker builds** — fixed rolldown and lightningcss Linux bindings for frontend image. (#b07e79c, #356bdab, #6d788e7)
- **Nanoclaw tailer** — fixed SQLite row access patterns. (#8e60ad2)

### Security

- **CI scanning pipeline** — `pip-audit` for Python deps, `npm audit` for Node deps, TruffleHog for secrets. (#8307e23)
- **CSP headers** — Content Security Policy added to backend responses. (#8307e23)
- **Audit findings addressed** — security fixes applied before live-agent-ops merge. (#e7d06b4)

### Removed

- **Channel nodes from canvas** — outer-ring channel nodes removed to reduce visual density. (#9c65593)
- **Capability highlight chips** — removed from masthead. (#0ae5eb6)
- **Now-streaming chip** — removed from masthead. (#fb2ab26)
- **Activity/last-event line from agent cards** — second line showing current tool or last event type removed. (#4a2111a)

### Documentation

- Architecture docs updated for live agent ops data pipeline. (#91e1d4e)
- Decision log (ADR 0007) for live agent ops feature. (#91e1d4e)
- README schema and agent grid description synced to current codebase. (#ce42308)
- Screenshots updated throughout to reflect UI evolution. (multiple commits)
- AGENTS.md consolidated with universal agent rules. (#ae473c1)
- THIRD_PARTY.md maintained with every dependency change.

## [0.9-prerelease] — 2026-07-26

Initial scaffold with FastAPI backend, Vite + React + TypeScript frontend, mock telemetry source, WebSocket transport, orbit canvas visualization, agent grid, event feed, debug panel, Docker Compose deployment, and CI security scanning.

[1.0.0]: https://github.com/niels-emmer/nanoclaw-dashboard/releases/tag/v1.0.0
[0.9-prerelease]: https://github.com/niels-emmer/nanoclaw-dashboard/releases/tag/v0.9-prerelease
