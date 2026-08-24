import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FlowCanvas } from './FlowCanvas'
import type { AgentSnapshot, EdgePulse } from '../lib/types'

const agent = (id: string, label: string): AgentSnapshot => ({
  id,
  label,
  state: 'idle',
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
  liveness: 'alive',
  containerStatus: 'running',
  heartbeatAgeMs: 1000,
  provider: 'claude',
  model: 'sonnet',
  uptimeMs: 1000,
  pendingApprovals: 0,
  errorCount: 0,
})

describe('FlowCanvas', () => {
  it('renders orchestrator and agent nodes', () => {
    const agents = [agent('orchestrator', 'orchestrator'), agent('agent:researcher', 'researcher')]
    render(<FlowCanvas orchestratorId="orchestrator" agents={agents} edges={[]} bubbles={[]} topology={null} />)
    expect(screen.getByText('orchestrator')).toBeInTheDocument()
    expect(screen.getByText('researcher')).toBeInTheDocument()
  })

  it('renders pulse edges for active traffic', () => {
    const agents = [agent('orchestrator', 'orchestrator'), agent('agent:researcher', 'researcher')]
    const edges: EdgePulse[] = [
      { id: 'e1', source: 'orchestrator', target: 'agent:researcher', type: 'question', timestamp: Date.now() },
    ]
    render(<FlowCanvas orchestratorId="orchestrator" agents={agents} edges={edges} bubbles={[]} topology={null} />)
    expect(document.querySelector('.edge-pulse')).toBeInTheDocument()
  })

  it('renders a chat bubble for a message', () => {
    const agents = [agent('orchestrator', 'orchestrator'), agent('agent:researcher', 'researcher')]
    const bubbles = [
      {
        id: 'b1',
        agentId: 'agent:researcher',
        fromLabel: 'orchestrator',
        toLabel: 'researcher',
        text: 'Research the latest trends',
        lines: ['Research the latest trends'],
        type: 'question' as const,
      },
    ]
    render(<FlowCanvas orchestratorId="orchestrator" agents={agents} edges={[]} bubbles={bubbles} topology={null} />)
    expect(document.querySelector('.chat-bubble')).toBeInTheDocument()
  })
})
