# Nanoclaw Dashboard – Frontend

This package houses the Vite + React + TypeScript SPA that renders the live nanoclaw orchestration dashboard (left-to-right tree graph, live activity feed, compact agent roster, status strip). See the root `README.md` for the end-to-end stack view.

## Commands

```bash
# Install deps (Node 20.19.0 – vendored under .tools/node)
PATH="$REPO/.tools/node/bin:$PATH" npm install

# Dev server (connects to backend ws://localhost:8000/ws/events by default)
npm run dev

# Production build + lint
npm run build
npm run lint
```

Set `VITE_BACKEND_WS_URL` when the backend lives somewhere other than `localhost:8000`.

## Configuration Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `VITE_BACKEND_WS_URL` | Inferred (`ws://localhost:8000/ws/events`) | WebSocket server endpoint |
| `VITE_EVENT_HISTORY` | `200` | Max telemetry events retained in client memory |
| `VITE_AGENT_SOLID_MINUTES` | `15` | Minutes an active agent stays 100% solid before fading |
| `VITE_AGENT_FADE_MINUTES` | `90` | Linear fade-out duration before an agent is auto-removed from the tree graph |
| `VITE_ORCHESTRATOR_ID` | `orchestrator` | Root orchestrator node identifier |

## Structure

- `src/hooks/useEventStream.ts` – thin WebSocket ingest layer (connect/reconnect) that dispatches events into the reducer.
- `src/lib/eventReducer.ts` – pure `useReducer` store deriving events, agent snapshots, edge pulses, topology, and the sticky human-facing agent.
- `src/lib/utils.ts`, `src/lib/treeLayout.ts`, `src/lib/treePaths.ts`, `src/lib/channels.ts`, `src/lib/activityFeed.ts`, `src/lib/icons.ts` – pure derivation helpers (snapshots, liveness, opacity, tree layout, edge/pulse paths, channel detection, feed filtering, icon mapping).
- `src/components/tree/` – SVG tree renderer (`TreeGraph`, `TreeNode`, `TreeEdge`).
- `src/components/ActivityFeed.tsx`, `AgentRoster.tsx`, `AgentDetail.tsx`, `StatusStrip.tsx` – supporting panels + diagnostics.
- `src/lib/types.ts` – Canonical telemetry types mirrored from the backend.
- `src/index.css` / `App.css` – design tokens (colors + typography) single-sourced in `index.css` `:root`; keep modifications intentional.
- `src/**/*.test.ts(x)` – Vitest suite (`npm test`).

Frontend changes must stay in sync with backend schema updates and be recorded in `docs/decision-log.md` when they alter contracts.
