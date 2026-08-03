# Nanoclaw Dashboard – Frontend

This package houses the Vite + React + TypeScript SPA that renders the live nanoclaw orchestration dashboard (orbit canvas, agent grid, event feed, debug tools). See the root `README.md` for the end-to-end stack view.

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
| `VITE_AGENT_FADE_MINUTES` | `90` | Linear fade-out duration before agent is auto-removed from orbit canvas |
| `VITE_ORCHESTRATOR_ID` | `orchestrator` | Center orchestrator node identifier |

## Structure

- `src/hooks/useEventStream.ts` – WebSocket ingestion, reconnection, agent snapshot + edge pulse derivation.
- `src/components/FlowCanvas.tsx` – SVG-based orbit renderer and directional pulse animations.
- `src/components/AgentGrid.tsx`, `EventFeed.tsx`, `DebugPanel.tsx`, `ConnectionStatus.tsx` – supporting panels + diagnostics.
- `src/lib/types.ts` – Canonical telemetry types mirrored from the backend.
- `src/index.css` / `App.css` – typography + color tokens for the 1080p TV layout; keep modifications intentional.

Frontend changes must stay in sync with backend schema updates and be recorded in `docs/decision-log.md` when they alter contracts.
