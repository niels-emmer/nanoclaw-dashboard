# V2 Frontend Plan — Nanoclaw Dashboard

_Status: Proposed (2026-08-24) · Branch: `feature/v2-frontend-rearchitecture`_

## Objective

Rebuild the frontend architecture for maintainability and testability without
changing the visual identity or the telemetry contract. The orbit canvas, agent
grid, and event feed stay; the code that powers them gets restructured so v3+
features (drill-downs, timelines, sparklines) are cheap to add.

**Non-goals (out of scope for v2):** no backend changes, no schema changes
(`schema_version` stays `0.2.0`), no new visual panels, no dependency additions
unless a test runner requires it.

## Scope

**In:**
1. Consolidate the design system into one explicit token layer
2. Decompose `FlowCanvas` (600-line monolith) into focused components
3. Extract state derivation out of `useEventStream` into a testable reducer
4. Add frontend test coverage (Vitest) for pure logic
5. Remove dead code + polish (title, unused assets)

**Out:** new UI panels, backend work, schema changes, new runtime deps.

## Acceptance Criteria (machine-verifiable)

- [ ] `npm run lint` → 0 warnings, 0 errors
- [ ] `npm run build` → succeeds (tsc + vite)
- [ ] `npm test` → new Vitest suite passes (target: ≥80% coverage on `lib/utils.ts` derivation logic)
- [ ] `npm run dev` → dashboard renders, connects to WS, orbit pulses animate
- [ ] No dead code: `DebugPanel.tsx` and `assets/{hero.png,react.svg,vite.svg}` removed; `index.html` title = "Nanoclaw Dashboard"
- [ ] `THIRD_PARTY.md` updated if any dev dep added (Vitest)
- [ ] Backend untouched — `cd backend && pytest` still 8 passed

## Task List (phased)

### Phase 1 — Cleanup & polish (low risk, do first)
- [ ] Delete `DebugPanel.tsx` (dead — App.tsx uses inline panel)
- [ ] Delete `assets/hero.png`, `react.svg`, `vite.svg`
- [ ] Fix `index.html` `<title>` → "Nanoclaw Dashboard"
- [ ] Update `frontend/README.md` (remove DebugPanel reference)

### Phase 2 — Design system consolidation
- [ ] Create a single `src/styles/tokens.css` (or extend `index.css`) defining all tokens: `--bg`, `--surface`, `--fg`, `--muted`, `--accent`, `--display`, `--sans`, `--mono`, spacing, radii
- [ ] Replace HeroUI-derived `var(--accent/--surface/--foreground/--background)` usages in `App.css` with explicit tokens
- [ ] Verify no visual regression against `docs/screenshot.png`

### Phase 3 — State management refactor
- [ ] Extract `deriveAgentSnapshot`, `deriveLiveness`, `computeAgentOpacity`, `parseTopologyMeta`, `normalizeAgentId` into a pure `lib/derive.ts` (or keep in `utils.ts` but make it dependency-free of `config`)
- [ ] Refactor `useEventStream` to a thin ingest layer: WS connect/reconnect + dispatch events into a `useReducer`-backed store
- [ ] Move edge/bubble TTL logic into the reducer (pure, testable)

### Phase 4 — Componentize FlowCanvas
- [ ] Split into: `OrbitLayout` (node positioning), `AgentNode`, `EdgeLayer` (spines + pulses + a2a), `ChatBubbleLayer`, `TooltipLayer`
- [ ] Keep `FlowCanvas` as the composition root; props contract unchanged
- [ ] Extract the icon-keyword map (`ICON_KEYWORDS`) into `lib/icons.ts`

### Phase 5 — Frontend tests
- [ ] Add Vitest + `@testing-library/react` (dev deps only)
- [ ] Unit tests: `deriveAgentSnapshot` (state transitions, tool clearing, provider isolation), `deriveLiveness`, `computeAgentOpacity`, `parseTopologyMeta`, `colorForAgent`
- [ ] Component smoke test: `FlowCanvas` renders nodes given mock agents/edges
- [ ] Wire `npm test` script + CI job

### Phase 6 — Verification & docs
- [ ] Run full gate: `pytest` (backend) + `lint` + `build` + `test` (frontend)
- [ ] Update `THIRD_PARTY.md` (Vitest, testing-library)
- [ ] Add ADR entry via `/decision-log` for the v2 architecture
- [ ] Update `docs/ARCHITECTURE.md` component responsibilities

## Verification Strategy

- **Per phase:** run the narrowest check (lint after Phase 1, build after Phase 2, tests after Phase 5)
- **Full gate before merge:** `cd backend && pytest && cd ../frontend && npm run lint && npm run build && npm test`
- **Visual:** compare against `docs/screenshot.png` after Phase 2/4

## Risks

| Risk | Mitigation |
|------|-----------|
| Token consolidation causes visual drift | Screenshot comparison after Phase 2 |
| Reducer refactor changes behavior | Existing derivation logic is pure — tests lock it in Phase 5 |
| Vitest adds build complexity | Dev-only dep; Vite-native, minimal config |
