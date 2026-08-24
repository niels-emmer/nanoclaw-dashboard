import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TreeGraph } from './tree/TreeGraph'
import type { AgentSnapshot, EdgePulse, TopologyData } from '../lib/types'

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

const topology: TopologyData = {
  channels: [],
  a2aEdges: [],
  tree: { root: 'orchestrator', children: { 'agent:route-planner': ['agent:route-optimizer', 'agent:route-validator'] } },
}

describe('TreeGraph', () => {
  it('renders orchestrator and agent nodes', () => {
    const agents = [agent('orchestrator', 'orchestrator'), agent('agent:researcher', 'researcher')]
    render(<TreeGraph orchestratorId="orchestrator" agents={agents} edges={[]} topology={null} />)
    expect(screen.getByText('orchestrator')).toBeInTheDocument()
    expect(screen.getByText('researcher')).toBeInTheDocument()
  })

  it('renders a tool indicator for an active agent', () => {
    const agents = [
      agent('orchestrator', 'orchestrator'),
      {
        ...agent('agent:researcher', 'researcher', 'running'),
        currentTool: 'Bash',
        currentToolCategory: 'executing' as const,
        toolElapsedMs: 12_000,
        tools: [{ name: 'Bash', category: 'executing' as const, active: true }],
      },
    ]
    render(<TreeGraph orchestratorId="orchestrator" agents={agents} edges={[]} topology={null} />)
    expect(document.querySelector('.tool-indicator')).toBeInTheDocument()
  })

  it('renders pulse edges for active traffic', () => {
    const agents = [agent('orchestrator', 'orchestrator'), agent('agent:researcher', 'researcher')]
    const edges: EdgePulse[] = [
      { id: 'e1', source: 'orchestrator', target: 'agent:researcher', type: 'question', timestamp: Date.now() },
    ]
    render(<TreeGraph orchestratorId="orchestrator" agents={agents} edges={edges} topology={null} />)
    expect(document.querySelector('.edge-pulse')).toBeInTheDocument()
  })

  it('renders parent-child tree edges from topology', () => {
    const agents = [
      agent('orchestrator', 'orchestrator'),
      agent('agent:route-planner', 'route-planner'),
      agent('agent:route-optimizer', 'route-optimizer'),
      agent('agent:route-validator', 'route-validator'),
    ]
    render(<TreeGraph orchestratorId="orchestrator" agents={agents} edges={[]} topology={topology} />)
    expect(document.querySelectorAll('.tree-edge').length).toBeGreaterThanOrEqual(2)
  })
})
