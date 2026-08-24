# V3 Frontend Plan — "Live Orchestration" Wallboard

_Status: Completed (2026-08-24) · Branch: `chore/audit-and-v2-planning`_

## Objective

Overhaul the dashboard UI for its real use case: a **widescreen 1080p wall display** (TV via HDMI, Firefox) whose purpose is to show **"what's happening right now"** — to give people a feel for what nanoclaw, orchestration, and multi-agent frameworks are about. The design must be glanceable from a distance, dark, and alive with current activity, while still supporting mouse hover/click drill-down.

## Confirmed decisions

1. **Tree orientation:** left-to-right (root on left, like a file tree).
2. **Activity feed:** simplified to a clean "conversation" stream (messages + tool calls, less noise).
3. **Drill-down:** single click-to-expand detail panel (agent tools/skills/transcript) is enough.
4. **Roster strip:** auto-hides after an idle timeout.
5. **Approach:** refactor in place on the current branch.

## Layout (4 zones)

```
┌──────────────────────────────────────────────────────────────────────┐
│ TOP STATUS STRIP   Orchestrator · Live · N active · ⚠ stuck · pending │
├───────────────────────────────────────────────┬──────────────────────┤
│                                               │  LIVE ACTIVITY FEED   │
│   TREE GRAPH (primary, ~60%)                  │  (promoted, ~40%)     │
│   orchestrator (root)                         │  - conversation stream│
│    ├─ researcher  ⚙ WebSearch 12s/20s  ●      │  - messages + tools   │
│    ├─ coder       ⚙ Bash 45s/120s     ●      │  - errors highlighted │
│    ├─ route-planner                          │                       │
│    │   ├─ sub-agent A                        │                       │
│    │   └─ sub-agent B                        │                       │
│    └─ architect   (idle, faded)              │                       │
├───────────────────────────────────────────────┴──────────────────────┤
│ COMPACT AGENT ROSTER (slim strip, auto-hides)  ● name ⚙tool · msgs · err │
└──────────────────────────────────────────────────────────────────────┘
```

## Pain-point mapping

| Pain point | Fix |
|-----------|-----|
| Graph mostly empty | Tree layout filled with live data: active agents large + current tool chips + pulses; inactive faded. |
| Tool indicator illegible | Current tool = prominent chip on active nodes (icon + name + elapsed) in readable type. |
| Star vs tree | 2-level tree (orchestrator → agents → sub-agents) matching the real hierarchy. |
| Agents panel 25% static | Collapse to a slim 1-line roster strip that auto-hides when idle. |
| Latest traffic smallest | Promote the activity feed to a prominent right panel (~40%). |
| Errors/stuck matter | Alert banner in top strip + red highlight in roster + feed; amber ring on stuck graph nodes. |

## Tool visibility

- **What's running now:** prominent tool chip on each active agent node + in the roster line.
- **Tools used/history:** click an agent → drill-down panel (tool icons + names, skills, recent activity).

## Interaction

- Passive by default — everything critical is on-screen (no hover needed).
- Mouse available: hover → tooltip; click agent → drill-down panel; click event → expand.

## Scale

~10 agents, 2-4 active at once. Inactive agents fade to keep focus on the active few.

## Task list

- [ ] Add mock hierarchy data (sub-agents) so the tree demo works
- [ ] Build tree layout (`lib/treeLayout.ts`, left-to-right)
- [ ] Build `TreeGraph` + `TreeNode` + `TreeEdge` components
- [ ] Build simplified `ActivityFeed` (conversation stream)
- [ ] Build compact `AgentRoster` strip (auto-hide when idle)
- [ ] Build `AgentDetail` drill-down panel
- [ ] Build `StatusStrip` (top bar with alerts)
- [ ] Rewire `App.tsx` to the new 4-zone layout
- [ ] Verify: lint, build, test, runtime smoke

## Verification

- `cd backend && pytest` (8 passed)
- `cd frontend && npm run lint && npm run build && npm test`
- Runtime smoke: backend + frontend dev servers, confirm tree renders with active agents + tool chips.
