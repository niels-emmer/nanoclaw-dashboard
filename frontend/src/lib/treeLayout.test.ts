import { describe, it, expect } from 'vitest'
import { computeTreeLayout, deriveTreeFromEdges } from './treeLayout'
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

  it('places a human node above the human-facing agent', () => {
    const agents = [agent('agent:marvin', 'marvin')]
    const now = Date.now()
    const nodes = computeTreeLayout(agents, 'orchestrator', null, now, 15, 90, 'agent:marvin', now - 1000)
    const human = nodes.find((n) => n.id === 'human')
    const marvin = nodes.find((n) => n.id === 'agent:marvin')
    expect(human).toBeDefined()
    expect(marvin).toBeDefined()
    expect(human!.x).toBe(marvin!.x)
    expect(human!.y).toBeLessThan(marvin!.y)
  })

  it('omits the human node when no human-facing agent is given', () => {
    const agents = [agent('agent:marvin', 'marvin')]
    const nodes = computeTreeLayout(agents, 'orchestrator', null, Date.now(), 15, 90)
    expect(nodes.some((n) => n.id === 'human')).toBe(false)
  })

  it('fades the human node out during inactivity', () => {
    const agents = [agent('agent:marvin', 'marvin')]
    const now = Date.now()
    // Recently active → fully visible.
    const active = computeTreeLayout(agents, 'orchestrator', null, now, 15, 90, 'agent:marvin', now - 1000)
    expect(active.find((n) => n.id === 'human')?.opacity).toBe(1)
    // Inactive beyond solid+fade window → faded out and removed.
    const faded = computeTreeLayout(agents, 'orchestrator', null, now, 15, 90, 'agent:marvin', now - 200 * 60 * 1000)
    expect(faded.some((n) => n.id === 'human')).toBe(false)
  })

  it('keeps the orchestrator root fully opaque regardless of activity', () => {
    const agents = [agent('agent:marvin', 'marvin')]
    const now = Date.now()
    const nodes = computeTreeLayout(agents, 'agent:marvin', null, now, 15, 90, 'agent:marvin', now - 200 * 60 * 1000)
    const root = nodes.find((n) => n.id === 'agent:marvin')
    expect(root?.opacity).toBe(1)
  })

  it('derives a hierarchy from a2aEdges via BFS from the orchestrator', () => {
    const edges = [
      { source: 'agent:marvin', target: 'agent:wp1a1j' },
      { source: 'agent:wp1a1j', target: 'agent:marvin' },
      { source: 'agent:marvin', target: 'agent:other' },
      { source: 'agent:wp1a1j', target: 'agent:local-guide' },
      { source: 'agent:local-guide', target: 'agent:wp1a1j' },
    ]
    const tree = deriveTreeFromEdges('agent:marvin', edges)
    expect(tree.children['agent:marvin']).toContain('agent:wp1a1j')
    expect(tree.children['agent:marvin']).toContain('agent:other')
    expect(tree.children['agent:wp1a1j']).toContain('agent:local-guide')
  })

  it('nests sub-agents under their parent from derived edges', () => {
    const agents = [
      agent('agent:marvin', 'marvin'),
      agent('agent:wp1a1j', 'wp1a1j'),
      agent('agent:local-guide', 'local guide'),
    ]
    const topology: TopologyData = {
      channels: [],
      a2aEdges: [
        { source: 'agent:marvin', target: 'agent:wp1a1j' },
        { source: 'agent:wp1a1j', target: 'agent:local-guide' },
      ],
    }
    const nodes = computeTreeLayout(agents, 'agent:marvin', topology, Date.now(), 15, 90)
    const localGuide = nodes.find((n) => n.id === 'agent:local-guide')
    expect(localGuide?.parentId).toBe('agent:wp1a1j')
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
