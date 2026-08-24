import { useMemo, useState, useEffect } from 'react'

import { config } from '../lib/config'
import type { AgentSnapshot, ChatBubble, EdgePulse, TopologyData } from '../lib/types'
import { ORCHESTRATOR_COLOR } from '../lib/utils'
import { computeNodes, WIDTH, HEIGHT, type NodePosition } from '../lib/orbitLayout'
import { AgentNode } from './canvas/AgentNode'
import { EdgeLayer } from './canvas/EdgeLayer'
import { ChatBubbleLayer } from './canvas/ChatBubbleLayer'
import { TooltipLayer } from './canvas/TooltipLayer'

interface FlowCanvasProps {
  orchestratorId: string
  agents: AgentSnapshot[]
  edges: EdgePulse[]
  bubbles: ChatBubble[]
  topology: TopologyData | null
  onAgentClick?: (agentId: string) => void
  selectedAgentId?: string | null
}

export function FlowCanvas({ orchestratorId, agents, edges, bubbles, topology, onAgentClick, selectedAgentId }: FlowCanvasProps) {
  const [hoveredAgent, setHoveredAgent] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now())

  // Tick loop every 15s to update agent decay during lulls
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000)
    return () => clearInterval(timer)
  }, [])

  const nodes = useMemo<NodePosition[]>(
    () => computeNodes(agents, orchestratorId, topology, now, config.agentSolidMinutes, config.agentFadeMinutes),
    [agents, orchestratorId, topology, now],
  )

  const nodeMap = useMemo(() => Object.fromEntries(nodes.map((node) => [node.id, node])), [nodes])
  const agentMap = useMemo(() => Object.fromEntries(agents.map((a) => [a.id, a])), [agents])

  const baseEdges = useMemo(() => {
    return agents
      .filter((agent) => agent.id !== orchestratorId)
      .map((agent) => ({
        source: orchestratorId,
        target: agent.id,
      }))
  }, [agents, orchestratorId])

  // Agent-to-agent edges from topology
  const a2aEdges = useMemo(() => {
    if (!topology) return []
    return topology.a2aEdges.filter((edge) => {
      const src = edge.source.replace('agent:', '')
      const tgt = edge.target.replace('agent:', '')
      return nodeMap[src] && nodeMap[tgt]
    })
  }, [topology, nodeMap])

  const resolvedPulses = edges
    .map((edge) => {
      const start = nodeMap[edge.source]
      const end = nodeMap[edge.target]
      if (!start || !end) return null
      return {
        ...edge,
        start,
        end,
      }
    })
    .filter(Boolean) as Array<EdgePulse & { start: NodePosition; end: NodePosition }>

  // Hovered agent data for tooltip
  const hoveredData = hoveredAgent ? agentMap[hoveredAgent] ?? agents.find((a) => a.id === hoveredAgent) : null

  return (
    <div className="flow-canvas">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={`Orchestrator topology: ${agents.length} agents connected to ${orchestratorId}. ${edges.length} active event pulses.`}>
        <defs>
          <radialGradient id="orchestratorGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={ORCHESTRATOR_COLOR} stopOpacity="0.4" />
            <stop offset="100%" stopColor={ORCHESTRATOR_COLOR} stopOpacity="0" />
          </radialGradient>
          <filter id="tooltipShadow">
            <feDropShadow dx="0" dy="2" stdDeviation="4" floodOpacity="0.3" />
          </filter>
        </defs>

        <EdgeLayer baseEdges={baseEdges} a2aEdges={a2aEdges} resolvedPulses={resolvedPulses} nodeMap={nodeMap} />

        {/* Agent nodes */}
        {nodes.map((node) => {
          const isOrchestrator = node.id === orchestratorId
          const isSelected = selectedAgentId === node.id
          return (
            <AgentNode
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

        <TooltipLayer hoveredAgent={hoveredAgent} hoveredData={hoveredData} nodeMap={nodeMap} />
        <ChatBubbleLayer bubbles={bubbles} nodeMap={nodeMap} />
      </svg>
      <div className="canvas-overlay" aria-hidden>
        <div className="grid-lines" />
        <div className="grid-lines" />
      </div>
    </div>
  )
}
