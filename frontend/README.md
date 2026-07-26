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

## Structure

- `src/hooks/useEventStream.ts` – WebSocket ingestion, reconnection, agent snapshot + edge pulse derivation.
- `src/components/FlowCanvas.tsx` – SVG-based orbit renderer and directional pulse animations.
- `src/components/AgentGrid.tsx`, `EventFeed.tsx`, `DebugPanel.tsx`, `ConnectionStatus.tsx` – supporting panels + diagnostics.
- `src/lib/types.ts` – Canonical telemetry types mirrored from the backend.
- `src/index.css` / `App.css` – typography + color tokens for the 1080p TV layout; keep modifications intentional.

Frontend changes must stay in sync with backend schema updates and be recorded in `docs/DECISIONS.md` when they alter contracts.
