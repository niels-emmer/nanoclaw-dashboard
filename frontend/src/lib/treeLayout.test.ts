import { describe, it, expect } from 'vitest'
import { computeTreeLayout } from './treeLayout'
import type { AgentSnapshot, TopologyData } from './types'

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

describe('computeTreeLayout', () => {
  it('always renders the orchestrator root even when absent from agents', () => {
    const agents = [agent('agent:researcher', 'researcher')]
    const nodes = computeTreeLayout(agents, 'orchestrator', null, Date.now(), 15, 90)
    expect(nodes.some((n) => n.id === 'orchestrator')).toBe(true)
  })

  it('produces non-overlapping nodes', () => {
    const agents = [
      agent('agent:researcher', 'researcher'),
      agent('agent:coder', 'coder'),
      agent('agent:architect', 'architect'),
      agent('agent:editor', 'editor'),
      agent('agent:terminal', 'terminal'),
      agent('agent:plotter', 'plotter'),
      agent('agent:route-planner', 'route-planner'),
      agent('agent:route-optimizer', 'route-optimizer'),
      agent('agent:route-validator', 'route-validator'),
    ]
    const nodes = computeTreeLayout(agents, 'orchestrator', topology, Date.now(), 15, 90)
    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const a = nodes[i]
        const b = nodes[j]
        const dx = a.x - b.x
        const dy = a.y - b.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        expect(dist).toBeGreaterThanOrEqual(a.radius + b.radius - 1)
      }
    }
  })

  it('nests sub-agents under their parent', () => {
    const agents = [
      agent('agent:route-planner', 'route-planner'),
      agent('agent:route-optimizer', 'route-optimizer'),
      agent('agent:route-validator', 'route-validator'),
    ]
    const nodes = computeTreeLayout(agents, 'orchestrator', topology, Date.now(), 15, 90)
    const optimizer = nodes.find((n) => n.id === 'agent:route-optimizer')
    const validator = nodes.find((n) => n.id === 'agent:route-validator')
    expect(optimizer?.parentId).toBe('agent:route-planner')
    expect(validator?.parentId).toBe('agent:route-planner')
  })
})
