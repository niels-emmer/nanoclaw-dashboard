import { describe, it, expect } from 'vitest'
import { createInitialState, eventReducer } from './eventReducer'
import type { TelemetryEvent } from './types'

const baseEvent = (overrides: Partial<TelemetryEvent> = {}): TelemetryEvent => ({
  id: '1',
  timestamp: '2026-08-24T00:00:00Z',
  type: 'question',
  source: 'orchestrator',
  target: 'agent:researcher',
  payload: { summary: 'Do the thing', status: 'running' },
  agent_state: 'running',
  schema_version: '0.2.0',
  ...overrides,
})

const dispatch = (state: ReturnType<typeof createInitialState>, event: TelemetryEvent, now = 1000) =>
  eventReducer(state, { type: 'event', event, now, maxEventHistory: 200 })

describe('eventReducer', () => {
  it('derives an agent snapshot from a question event', () => {
    const next = dispatch(createInitialState('orchestrator'), baseEvent())
    expect(next.snapshots['agent:researcher']).toBeDefined()
    expect(next.snapshots['agent:researcher'].state).toBe('running')
    expect(next.snapshots['agent:researcher'].activityCount).toBe(1)
  })

  it('transitions running -> idle on response', () => {
    let state = createInitialState('orchestrator')
    state = dispatch(state, baseEvent())
    const response = baseEvent({
      id: '2',
      type: 'response',
      source: 'agent:researcher',
      target: 'orchestrator',
      agent_state: 'idle',
      payload: { summary: 'Done', status: 'completed' },
    })
    state = dispatch(state, response, 2000)
    expect(state.snapshots['agent:researcher'].state).toBe('idle')
  })

  it('clears currentTool when activity completes', () => {
    let state = createInitialState('orchestrator')
    const activity = baseEvent({
      id: '1',
      type: 'activity_update',
      source: 'agent:researcher',
      target: 'orchestrator',
      payload: { summary: 'Running Bash', status: 'processing', current_tool: 'Bash' },
    })
    state = dispatch(state, activity)
    expect(state.snapshots['agent:researcher'].currentTool).toBe('Bash')

    const complete = baseEvent({
      id: '2',
      type: 'activity_update',
      source: 'agent:researcher',
      target: 'orchestrator',
      payload: { summary: 'Done', status: 'completed' },
    })
    state = dispatch(state, complete, 2000)
    expect(state.snapshots['agent:researcher'].currentTool).toBeNull()
  })

  it('maintains a tool history with the active tool first', () => {
    let state = createInitialState('orchestrator')
    const bash = baseEvent({
      id: '1',
      type: 'activity_update',
      source: 'agent:researcher',
      target: 'orchestrator',
      payload: { summary: 'Running Bash', status: 'processing', current_tool: 'Bash' },
    })
    state = dispatch(state, bash)
    expect(state.snapshots['agent:researcher'].tools).toEqual([
      { name: 'Bash', category: 'executing', active: true },
    ])

    const read = baseEvent({
      id: '2',
      type: 'activity_update',
      source: 'agent:researcher',
      target: 'orchestrator',
      payload: { summary: 'Running Read', status: 'processing', current_tool: 'Read' },
    })
    state = dispatch(state, read, 2000)
    const tools = state.snapshots['agent:researcher'].tools
    expect(tools[0]).toEqual({ name: 'Read', category: 'reading', active: true })
    expect(tools[1]).toEqual({ name: 'Bash', category: 'executing', active: false })
  })

  it('sets the human-facing agent from a real channel and keeps it sticky', () => {
    let state = createInitialState('orchestrator')
    const whatsapp = baseEvent({
      id: '1',
      type: 'question',
      source: 'channel:whatsapp',
      target: 'agent:marvin',
      payload: { summary: 'hi', status: 'running' },
    })
    state = dispatch(state, whatsapp)
    expect(state.humanAgentId).toBe('agent:marvin')

    // An internal "channel:agent" event must NOT move the human node.
    const internal = baseEvent({
      id: '2',
      type: 'response',
      source: 'agent:other',
      target: 'channel:agent',
      payload: { summary: 'internal', status: 'completed' },
    })
    state = dispatch(state, internal, 2000)
    expect(state.humanAgentId).toBe('agent:marvin')
  })

  it('does not treat internal agent channels as human', () => {
    const state = createInitialState('orchestrator')
    const internal = baseEvent({
      id: '1',
      type: 'response',
      source: 'agent:other',
      target: 'channel:agent',
      payload: { summary: 'internal', status: 'completed' },
    })
    const next = dispatch(state, internal)
    expect(next.humanAgentId).toBeNull()
    expect(next.humanLastUpdated).toBeNull()
  })

  it('tracks the last human-channel activity time', () => {
    let state = createInitialState('orchestrator')
    const whatsapp = baseEvent({
      id: '1',
      type: 'question',
      source: 'channel:whatsapp',
      target: 'agent:marvin',
      payload: { summary: 'hi', status: 'running' },
    })
    state = dispatch(state, whatsapp, 1000)
    expect(state.humanLastUpdated).toBe(1000)

    // Internal agent traffic must NOT advance the human activity clock.
    const internal = baseEvent({
      id: '2',
      type: 'response',
      source: 'agent:other',
      target: 'channel:agent',
      payload: { summary: 'internal', status: 'completed' },
    })
    state = dispatch(state, internal, 5000)
    expect(state.humanLastUpdated).toBe(1000)

    // A later human-channel event advances it.
    const later = baseEvent({
      id: '3',
      type: 'response',
      source: 'agent:marvin',
      target: 'channel:whatsapp',
      payload: { summary: 'reply', status: 'completed' },
    })
    state = dispatch(state, later, 9000)
    expect(state.humanLastUpdated).toBe(9000)
  })

  it('does not leak provider/model to a secondary agent', () => {
    let state = createInitialState('orchestrator')
    const a2a = baseEvent({
      id: '1',
      type: 'question',
      source: 'agent:architect',
      target: 'agent:researcher',
      payload: { summary: 'q', status: 'running', provider: 'claude', model: 'sonnet' },
    })
    state = dispatch(state, a2a)
    expect(state.snapshots['agent:researcher'].provider).toBe('claude')
    expect(state.snapshots['agent:architect'].provider).toBeNull()
  })

  it('excludes delivery_update from event history', () => {
    const delivery = baseEvent({
      id: '1',
      type: 'delivery_update',
      payload: { summary: 'delivered', status: 'delivered' },
    })
    const next = dispatch(createInitialState('orchestrator'), delivery)
    expect(next.events).toHaveLength(0)
  })

  it('caps event history at maxEventHistory', () => {
    let state = createInitialState('orchestrator')
    for (let i = 0; i < 5; i += 1) {
      state = dispatch(state, baseEvent({ id: String(i) }), i)
    }
    expect(state.events).toHaveLength(5)
  })

  it('updates orchestratorId from topology metadata', () => {
    const state = createInitialState('orchestrator')
    const topo = baseEvent({
      id: '1',
      type: 'topology_snapshot',
      source: 'orchestrator',
      target: 'dashboard',
      payload: {
        summary: 'topo',
        status: 'completed',
        meta: { orchestratorId: 'agent:boss', channels: '[]', a2aEdges: '[]' },
      },
    })
    const next = dispatch(state, topo)
    expect(next.orchestratorId).toBe('agent:boss')
  })
})
