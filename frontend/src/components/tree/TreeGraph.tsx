import { useMemo, useState, useEffect } from 'react'

import { config } from '../../lib/config'
import type { AgentSnapshot, EdgePulse, TopologyData } from '../../lib/types'
import { ORCHESTRATOR_COLOR, formatElapsed } from '../../lib/utils'
import { computeTreeLayout, WIDTH, HEIGHT, HUMAN_NODE_ID, type TreeNode } from '../../lib/treeLayout'
import { isHumanChannel } from '../../lib/channels'
import { TreeNodeView } from './TreeNode'
import { TreeEdge } from './TreeEdge'

interface TreeGraphProps {
  orchestratorId: string
  agents: AgentSnapshot[]
  edges: EdgePulse[]
  topology: TopologyData | null
  humanAgentId?: string | null
  onAgentClick?: (agentId: string) => void
  selectedAgentId?: string | null
}

export function TreeGraph({ orchestratorId, agents, edges, topology, humanAgentId, onAgentClick, selectedAgentId }: TreeGraphProps) {
  const [hoveredAgent, setHoveredAgent] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now())

  // Tick loop every 15s to update agent decay during lulls
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000)
    return () => clearInterval(timer)
  }, [])

  const nodes = useMemo<TreeNode[]>(
    () => computeTreeLayout(agents, orchestratorId, topology, now, config.agentSolidMinutes, config.agentFadeMinutes, humanAgentId),
    [agents, orchestratorId, topology, now, humanAgentId],
  )

  const nodeMap = useMemo(() => Object.fromEntries(nodes.map((node) => [node.id, node])), [nodes])
  const agentMap = useMemo(() => Object.fromEntries(agents.map((a) => [a.id, a])), [agents])

  // Resolve pulses. Real human channels map to the human node; the internal
  // "channel:agent" bus maps to the orchestrator (sub-agent replies go to the
  // orchestrator, not the human).
  const resolveEndpoint = (id: string): string => {
    if (!id.startsWith('channel:')) return id
    if (isHumanChannel(id)) return HUMAN_NODE_ID
    return orchestratorId
  }
  const pulses = edges
    .map((edge) => {
      const start = nodeMap[resolveEndpoint(edge.source)]
      const end = nodeMap[resolveEndpoint(edge.target)]
      if (!start || !end) return null
      return { ...edge, start, end }
    })
    .filter(Boolean) as Array<EdgePulse & { start: TreeNode; end: TreeNode }>

  const hoveredData = hoveredAgent ? agentMap[hoveredAgent] ?? agents.find((a) => a.id === hoveredAgent) : null
  const hoveredNode = hoveredAgent ? nodeMap[hoveredAgent] : null

  return (
    <div className="tree-canvas">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={`Orchestrator tree: ${agents.length} agents. ${edges.length} active event pulses.`}>
        <defs>
          <radialGradient id="orchestratorGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={ORCHESTRATOR_COLOR} stopOpacity="0.4" />
            <stop offset="100%" stopColor={ORCHESTRATOR_COLOR} stopOpacity="0" />
          </radialGradient>
          <filter id="softBlur" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="10" />
          </filter>
        </defs>

        <TreeEdge nodes={nodes} nodeMap={nodeMap} pulses={pulses} />

        {nodes.map((node) => {
          const isOrchestrator = node.id === orchestratorId
          const isSelected = selectedAgentId === node.id
          return (
            <TreeNodeView
              key={node.id}
              node={node}
              agent={agentMap[node.id]}
              isOrchestrator={isOrchestrator}
              isSelected={isSelected}
              onHover={setHoveredAgent}
              onLeave={() => setHoveredAgent(null)}
              onClick={(id) => onAgentClick?.(id)}
            />
          )
        })}

        {/* Hover tooltip */}
        {hoveredData && hoveredNode && (
          <foreignObject
            x={Math.min(hoveredNode.x + hoveredNode.radius + 12, WIDTH - 220)}
            y={Math.max(hoveredNode.y - 70, 10)}
            width={200}
            height={hoveredData.skills.length > 0 ? 120 : 90}
            className="tooltip-fo"
          >
            <div className="agent-tooltip">
              <div className="tooltip-name">{hoveredData.label}</div>
              <div className="tooltip-row">
                <span className="tooltip-label">Model:</span>
                <span>{hoveredData.provider ?? '?'}/{hoveredData.model ?? '?'}</span>
              </div>
              {hoveredData.currentTool && (
                <div className="tooltip-row">
                  <span className="tooltip-label">Tool:</span>
                  <span>{hoveredData.currentTool} ({formatElapsed(hoveredData.toolElapsedMs)})</span>
                </div>
              )}
              <div className="tooltip-row">
                <span className="tooltip-label">Activity:</span>
                <span>{hoveredData.activityCount} messages</span>
              </div>
              {hoveredData.skills.length > 0 && (
                <div className="tooltip-skills">
                  {hoveredData.skills.slice(0, 4).join(', ')}
                  {hoveredData.skills.length > 4 && ` +${hoveredData.skills.length - 4} more`}
                </div>
              )}
            </div>
          </foreignObject>
        )}
      </svg>
    </div>
  )
}
