import { describe, it, expect } from 'vitest'
import { buildActivityFeed } from './activityFeed'
import type { TelemetryEvent } from './types'

const evt = (overrides: Partial<TelemetryEvent>): TelemetryEvent => ({
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

describe('buildActivityFeed', () => {
  it('drops signalling-only activity_update cards (no current_tool)', () => {
    const feed = buildActivityFeed([
      evt({ id: '1', type: 'activity_update', payload: { summary: 'Message completed', status: 'completed' } }),
      evt({ id: '2', type: 'question', payload: { summary: 'Research X', status: 'running' } }),
    ])
    expect(feed).toHaveLength(1)
    expect(feed[0].type).toBe('question')
  })

  it('collapses consecutive same-agent/same-tool activity into one card with a count', () => {
    const feed = buildActivityFeed([
      evt({ id: '1', type: 'activity_update', source: 'agent:researcher', payload: { summary: 'Running Bash', status: 'processing', current_tool: 'Bash' } }),
      evt({ id: '2', type: 'activity_update', source: 'agent:researcher', payload: { summary: 'Running Bash', status: 'processing', current_tool: 'Bash' } }),
      evt({ id: '3', type: 'activity_update', source: 'agent:researcher', payload: { summary: 'Running Bash', status: 'processing', current_tool: 'Bash' } }),
    ])
    expect(feed).toHaveLength(1)
    expect(feed[0].count).toBe(3)
  })

  it('does not collapse different tools or different agents', () => {
    const feed = buildActivityFeed([
      evt({ id: '1', type: 'activity_update', source: 'agent:researcher', payload: { summary: 'Running Bash', status: 'processing', current_tool: 'Bash' } }),
      evt({ id: '2', type: 'activity_update', source: 'agent:researcher', payload: { summary: 'Running Read', status: 'processing', current_tool: 'Read' } }),
      evt({ id: '3', type: 'activity_update', source: 'agent:coder', payload: { summary: 'Running Bash', status: 'processing', current_tool: 'Bash' } }),
    ])
    expect(feed).toHaveLength(3)
    expect(feed.every((f) => f.count === 1)).toBe(true)
  })

  it('keeps error agent_status cards', () => {
    const feed = buildActivityFeed([
      evt({ id: '1', type: 'agent_status', payload: { summary: 'Tool timed out', status: 'error' }, agent_state: 'error' }),
    ])
    expect(feed).toHaveLength(1)
  })
})
