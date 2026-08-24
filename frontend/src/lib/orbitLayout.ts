import type { AgentSnapshot, AgentState, TopologyData } from './types'
import { computeAgentOpacity } from './utils'

export interface NodePosition {
  id: string
  x: number
  y: number
  radius: number
  label: string
  state: AgentState | 'unknown'
  opacity: number
}

export const WIDTH = 1000
export const HEIGHT = 560
export const CENTER = { x: WIDTH / 2, y: HEIGHT / 2 }

export function edgePointOnCircle(
  cx: number,
  cy: number,
  tx: number,
  ty: number,
  radius: number,
) {
  const dx = tx - cx
  const dy = ty - cy
  const dist = Math.sqrt(dx * dx + dy * dy)
  if (dist === 0) return { x: cx, y: cy }
  return {
    x: cx + (dx / dist) * radius,
    y: cy + (dy / dist) * radius,
  }
}

/**
 * Compute orbit node positions. Pure — given the same inputs it always
 * produces the same layout, so it is unit-testable.
 */
export function computeNodes(
  agents: AgentSnapshot[],
  orchestratorId: string,
  topology: TopologyData | null,
  now: number,
  solidMinutes: number,
  fadeMinutes: number,
): NodePosition[] {
  const opacityMap = new Map<string, number>()
  for (const agent of agents) {
    opacityMap.set(
      agent.id,
      computeAgentOpacity(agent.lastUpdated, solidMinutes, fadeMinutes, now),
    )
  }

  const activeAgents = agents.filter(
    (agent) => agent.id === orchestratorId || (opacityMap.get(agent.id) ?? 1) > 0,
  )
  const nonOrchestratorAgents = activeAgents.filter((agent) => agent.id !== orchestratorId)
  const agentCount = Math.max(nonOrchestratorAgents.length, 1)
  const orbit = Math.min(WIDTH, HEIGHT) / 2.7
  const orchestratorSnapshot = agents.find((agent) => agent.id === orchestratorId)
  const orchestrator: NodePosition = {
    id: orchestratorId,
    x: CENTER.x,
    y: CENTER.y,
    radius: 70,
    label: orchestratorSnapshot?.label ?? 'orchestrator',
    state: orchestratorSnapshot?.state ?? 'idle',
    opacity: 1.0,
  }

  // Greedy layout optimization: place agents that communicate adjacently
  const a2aPairs = new Set<string>()
  if (topology) {
    for (const edge of topology.a2aEdges) {
      const src = edge.source.replace('agent:', '')
      const tgt = edge.target.replace('agent:', '')
      a2aPairs.add(`${src}:${tgt}`)
      a2aPairs.add(`${tgt}:${src}`)
    }
  }

  // Sort agents so communicating ones are adjacent
  const sorted = [...nonOrchestratorAgents]
  if (a2aPairs.size > 0) {
    const adjList = new Map<string, string[]>()
    for (const a of sorted) adjList.set(a.id, [])
    for (const pair of a2aPairs) {
      const [a, b] = pair.split(':')
      adjList.get(a)?.push(b)
      adjList.get(b)?.push(a)
    }
    // Greedy BFS ordering
    const ordered: typeof sorted = []
    const visited = new Set<string>()
    const queue = [sorted[0]?.id].filter(Boolean)
    while (queue.length > 0) {
      const id = queue.shift()!
      if (visited.has(id)) continue
      visited.add(id)
      const agent = sorted.find((a) => a.id === id)
      if (agent) ordered.push(agent)
      for (const neighbor of adjList.get(id) ?? []) {
        if (!visited.has(neighbor)) queue.push(neighbor)
      }
    }
    for (const a of sorted) {
      if (!visited.has(a.id)) ordered.push(a)
    }
    sorted.length = 0
    sorted.push(...ordered)
  }

  const spokes = sorted.map((agent, idx) => {
    const angle = (idx / agentCount) * Math.PI * 2 - Math.PI / 2
    return {
      id: agent.id,
      x: CENTER.x + orbit * Math.cos(angle),
      y: CENTER.y + orbit * Math.sin(angle),
      radius: 52,
      label: agent.label,
      state: agent.state,
      opacity: opacityMap.get(agent.id) ?? 1.0,
    }
  })

  return [orchestrator, ...spokes]
}
