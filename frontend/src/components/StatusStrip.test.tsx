import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusStrip } from './StatusStrip'
import type { AgentSnapshot, TelemetryEvent } from '../lib/types'

const agent = (id: string, label: string, state: AgentSnapshot['state'] = 'idle'): AgentSnapshot => ({
  id,
  label,
  state,
  lastSummary: '',
  lastEventType: null,
  lastUpdated: Date.now(),
  firstSeen: Date.now(),
  activityCount: 0,
  lastEventSource: null,
  lastEventTarget: null,
  outboundTargets: [],
  inboundSources: [],
  skills: [],
  currentTool: null,
  currentToolCategory: 'thinking',
  toolElapsedMs: null,
  toolTimeoutMs: null,
  tools: [],
  liveness: 'alive',
  containerStatus: 'running',
  heartbeatAgeMs: 1000,
  provider: 'claude',
  model: 'sonnet',
  uptimeMs: 1000,
  pendingApprovals: 0,
  errorCount: 0,
})

const event = (id: string, ageMs: number): TelemetryEvent => ({
  id,
  timestamp: new Date(Date.now() - ageMs).toISOString(),
  type: 'question',
  source: 'channel:whatsapp',
  target: 'agent:marvin',
  payload: { summary: 'hi', status: 'running' },
  agent_state: 'running',
  schema_version: '0.2.0',
})

describe('StatusStrip', () => {
  it('renders title, orchestrator tag, metrics, clock and live status', () => {
    const agents = [agent('agent:marvin', 'marvin', 'running'), agent('agent:researcher', 'researcher')]
    const events = [event('1', 5000), event('2', 30000)]
    render(
      <StatusStrip orchestratorId="agent:marvin" connectionState="connected" retryCount={0} agents={agents} events={events} />,
    )

    expect(screen.getByText('NanoClaw Live Dashboard')).toBeInTheDocument()
    expect(screen.getByText('orchestrator · marvin')).toBeInTheDocument()
    expect(screen.getByText('1/2')).toBeInTheDocument()
    expect(screen.getByText('last activity')).toBeInTheDocument()
    expect(screen.getByText('msg/min')).toBeInTheDocument()
    expect(screen.getByText('Live')).toBeInTheDocument()
  })

  it('shows a dash for last activity when there are no events', () => {
    render(
      <StatusStrip orchestratorId="agent:marvin" connectionState="connected" retryCount={0} agents={[]} events={[]} />,
    )
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('counts messages within the last minute for the rate', () => {
    const agents = [agent('agent:marvin', 'marvin')]
    // 2 events inside the 60s window, 1 older than it.
    const events = [event('1', 1000), event('2', 20000), event('3', 120000)]
    render(
      <StatusStrip orchestratorId="agent:marvin" connectionState="connected" retryCount={0} agents={agents} events={events} />,
    )
    expect(screen.getByText('2')).toBeInTheDocument()
  })
})
