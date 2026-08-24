import type { AgentSnapshot, AgentState, TopologyData } from './types'
import { computeAgentOpacity } from './utils'

export interface TreeNode {
  id: string
  label: string
  state: AgentState | 'unknown'
  opacity: number
  x: number
  y: number
  radius: number
  depth: number
  parentId: string | null
  children: string[]
  isActive: boolean
}

export const WIDTH = 1000
export const HEIGHT = 900
export const CENTER = { x: WIDTH / 2, y: HEIGHT / 2 }

/**
 * Derive a parent-child hierarchy from the a2aEdges graph via BFS from the
 * orchestrator. Agents that talk to the orchestrator become direct children;
 * agents that only talk to a non-orchestrator agent become its sub-agents.
 * Used when the topology does not provide an explicit `tree`.
 */
export function deriveTreeFromEdges(
  orchestratorId: string,
  a2aEdges: Array<{ source: string; target: string }>,
): { root: string; children: Record<string, string[]> } {
  const adj = new Map<string, string[]>()
  for (const edge of a2aEdges) {
    const a = edge.source
    const b = edge.target
    if (!adj.has(a)) adj.set(a, [])
    if (!adj.has(b)) adj.set(b, [])
    adj.get(a)!.push(b)
    adj.get(b)!.push(a)
  }
  const children: Record<string, string[]> = {}
  const visited = new Set<string>([orchestratorId])
  const queue = [orchestratorId]
  while (queue.length > 0) {
    const node = queue.shift()!
    for (const neighbor of adj.get(node) ?? []) {
      if (visited.has(neighbor)) continue
      visited.add(neighbor)
      children[node] = [...(children[node] ?? []), neighbor]
      queue.push(neighbor)
    }
  }
  return { root: orchestratorId, children }
}

const LEVEL_GAP = 280
const ORCHESTRATOR_RADIUS = 44
const ACTIVE_RADIUS = 36
const INACTIVE_RADIUS = 28
const HUMAN_RADIUS = 34
const LEFT_MARGIN = ORCHESTRATOR_RADIUS + 24

export const HUMAN_NODE_ID = 'human'

/**
 * Compute a left-to-right tree layout. Pure — given the same inputs it always
 * produces the same layout, so it is unit-testable.
 *
 * Hierarchy: the orchestrator is the root (always rendered, even if not present
 * in the agents list). Agents are level-1 children by default; sub-agents (from
 * topology.tree.children) nest under their parent. Only agents with opacity > 0
 * (recently active) are shown, plus the root.
 */
export function computeTreeLayout(
  agents: AgentSnapshot[],
  orchestratorId: string,
  topology: TopologyData | null,
  now: number,
  solidMinutes: number,
  fadeMinutes: number,
  humanAgentId?: string | null,
): TreeNode[] {
  const opacityMap = new Map<string, number>()
  for (const agent of agents) {
    opacityMap.set(agent.id, computeAgentOpacity(agent.lastUpdated, solidMinutes, fadeMinutes, now))
  }

  const activeAgents = agents.filter(
    (agent) => agent.id !== orchestratorId && (opacityMap.get(agent.id) ?? 1) > 0,
  )
  const agentById = new Map(activeAgents.map((a) => [a.id, a]))

  // Build the children map. Default: every agent is a child of the orchestrator.
  const childrenMap: Record<string, string[]> = {}
  for (const agent of activeAgents) {
    childrenMap[orchestratorId] = [...(childrenMap[orchestratorId] ?? []), agent.id]
  }
  // Apply hierarchy: use the explicit tree if provided, else derive it from the
  // a2aEdges graph (BFS from the orchestrator). Move sub-agents under their parent.
  const treeChildren = topology?.tree?.children ?? deriveTreeFromEdges(orchestratorId, topology?.a2aEdges ?? []).children
  for (const [parent, subs] of Object.entries(treeChildren)) {
    for (const sub of subs) {
      if (!agentById.has(sub)) continue
      childrenMap[orchestratorId] = (childrenMap[orchestratorId] ?? []).filter((id) => id !== sub)
      childrenMap[parent] = [...(childrenMap[parent] ?? []), sub]
    }
  }

  // Vertical spacing: at least one node diameter (no overlap), and shrink to fit
  // the viewBox height when there are many agents.
  const maxAgentDiameter = ACTIVE_RADIUS * 2
  const totalNodes = Math.max(activeAgents.length, 1)
  const verticalGap = Math.max(maxAgentDiameter + 16, (HEIGHT - 120) / totalNodes)

  // Recursive layout: leaves get sequential y positions; parents center over children.
  const positions: Record<string, { x: number; y: number }> = {}
  let nextY = 0

  const layout = (id: string, depth: number): number => {
    const children = childrenMap[id] ?? []
    const x = depth * LEVEL_GAP + LEFT_MARGIN
    if (children.length === 0) {
      positions[id] = { x, y: nextY }
      nextY += verticalGap
      return positions[id].y
    }
    const childYs = children.map((c) => layout(c, depth + 1))
    const minY = Math.min(...childYs)
    const maxY = Math.max(...childYs)
    positions[id] = { x, y: (minY + maxY) / 2 }
    return positions[id].y
  }

  layout(orchestratorId, 0)

  // Radius and tool-indicator width per node, so the horizontal bounding box
  // includes any tool icons shown to the right of the agents.
  const radiusFor = (id: string): number => {
    if (id === orchestratorId) return ORCHESTRATOR_RADIUS
    const agent = agentById.get(id)
    return agent && agent.state === 'running' && agent.liveness === 'alive' ? ACTIVE_RADIUS : INACTIVE_RADIUS
  }
  const toolWidthFor = (id: string): number => {
    const n = agentById.get(id)?.tools.length ?? 0
    // Matches TreeNode: r=14, gap=8 → first tool at radius+20, each extra +36, last edge +14
    return n > 0 ? 34 + (n - 1) * 36 : 0
  }

  // Place the human node directly above the human-facing agent (e.g. marvin).
  let humanAgentPos: { x: number; y: number } | null = null
  if (humanAgentId && positions[humanAgentId]) {
    const agentPos = positions[humanAgentId]
    const agentRadius = radiusFor(humanAgentId)
    humanAgentPos = {
      x: agentPos.x,
      y: agentPos.y - (agentRadius + HUMAN_RADIUS + 96),
    }
    positions[HUMAN_NODE_ID] = humanAgentPos
  }

  // Center the whole tree (including tool indicators) both vertically and horizontally.
  const ys = Object.values(positions).map((p) => p.y)
  const leftEdges = Object.entries(positions).map(([id, p]) => p.x - radiusFor(id))
  const rightEdges = Object.entries(positions).map(([id, p]) => p.x + radiusFor(id) + toolWidthFor(id))
  const minX = Math.min(...leftEdges)
  const maxX = Math.max(...rightEdges)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const offsetX = (WIDTH - (minX + maxX)) / 2
  const offsetY = (HEIGHT - (minY + maxY)) / 2

  const parentOf = (id: string): string | null => {
    for (const [parent, children] of Object.entries(childrenMap)) {
      if (children.includes(id)) return parent
    }
    return null
  }

  const orchestratorSnapshot = agents.find((a) => a.id === orchestratorId)
  const orchestratorPos = positions[orchestratorId]
  const orchestratorNode: TreeNode = {
    id: orchestratorId,
    label: orchestratorSnapshot?.label ?? 'orchestrator',
    state: orchestratorSnapshot?.state ?? 'idle',
    opacity: 1,
    x: orchestratorPos.x + offsetX,
    y: orchestratorPos.y + offsetY,
    radius: ORCHESTRATOR_RADIUS,
    depth: 0,
    parentId: null,
    children: childrenMap[orchestratorId] ?? [],
    isActive: false,
  }

  const agentNodes: TreeNode[] = activeAgents.map((agent) => {
    const pos = positions[agent.id]
    const isActive = agent.state === 'running' && agent.liveness === 'alive'
    return {
      id: agent.id,
      label: agent.label,
      state: agent.state,
      opacity: opacityMap.get(agent.id) ?? 1,
      x: pos.x + offsetX,
      y: pos.y + offsetY,
      radius: isActive ? ACTIVE_RADIUS : INACTIVE_RADIUS,
      depth: Math.round(pos.x / LEVEL_GAP),
      parentId: parentOf(agent.id),
      children: childrenMap[agent.id] ?? [],
      isActive,
    }
  })

  const nodes: TreeNode[] = [orchestratorNode, ...agentNodes]

  if (humanAgentPos) {
    nodes.push({
      id: HUMAN_NODE_ID,
      label: 'Human',
      state: 'idle',
      opacity: 1,
      x: humanAgentPos.x + offsetX,
      y: humanAgentPos.y + offsetY,
      radius: HUMAN_RADIUS,
      depth: Math.round(humanAgentPos.x / LEVEL_GAP),
      parentId: humanAgentId ?? null,
      children: [],
      isActive: false,
    })
  }

  return nodes
}
