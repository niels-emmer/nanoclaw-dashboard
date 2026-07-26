import { useMemo } from 'react'

import type { AgentSnapshot, EdgePulse } from '../lib/types'

const WIDTH = 1000
const HEIGHT = 560
const CENTER = { x: WIDTH / 2, y: HEIGHT / 2 }

const ACCENT = '#7860d8'

interface FlowCanvasProps {
  orchestratorId: string
  agents: AgentSnapshot[]
  edges: EdgePulse[]
}

interface NodePosition {
  id: string
  x: number
  y: number
  radius: number
  label: string
}

export function FlowCanvas({ orchestratorId, agents, edges }: FlowCanvasProps) {
  const nodes = useMemo<NodePosition[]>(() => {
    const nonOrchestratorAgents = agents.filter((agent) => agent.id !== orchestratorId)
    const agentCount = Math.max(nonOrchestratorAgents.length, 1)
    const orbit = Math.min(WIDTH, HEIGHT) / 2.4
    const orchestratorSnapshot = agents.find((agent) => agent.id === orchestratorId)
    const orchestrator: NodePosition = {
      id: orchestratorId,
      x: CENTER.x,
      y: CENTER.y,
      radius: 70,
      label: orchestratorSnapshot?.label ?? 'orchestrator',
    }

    const spokes = nonOrchestratorAgents.map((agent, idx) => {
      const angle = (idx / agentCount) * Math.PI * 2 - Math.PI / 2
      return {
        id: agent.id,
        x: CENTER.x + orbit * Math.cos(angle),
        y: CENTER.y + orbit * Math.sin(angle),
        radius: 52,
        label: agent.label,
      }
    })

    return [orchestrator, ...spokes]
  }, [agents, orchestratorId])

  const nodeMap = useMemo(() => Object.fromEntries(nodes.map((node) => [node.id, node])), [nodes])

  const baseEdges = useMemo(() => {
    return agents
      .filter((agent) => agent.id !== orchestratorId)
      .map((agent) => ({
        source: orchestratorId,
        target: agent.id,
        color: ACCENT,
      }))
  }, [agents, orchestratorId])

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

  return (
    <div className="flow-canvas">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="presentation" aria-hidden>
        <defs>
          <radialGradient id="orchestratorGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={ACCENT} stopOpacity="0.5" />
            <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
          </radialGradient>
        </defs>
        {baseEdges.map((edge) => {
          const start = nodeMap[edge.source]
          const end = nodeMap[edge.target]
          if (!start || !end) return null
          return (
            <line
              key={edge.target}
              x1={start.x}
              y1={start.y}
              x2={end.x}
              y2={end.y}
              className="edge-spine"
              stroke={edge.color}
              strokeOpacity={0.35}
            />
          )
        })}

        {resolvedPulses.map((pulse) => (
          <line
            key={pulse.id}
            className={`edge-pulse pulse-${pulse.type}`}
            x1={pulse.start.x}
            y1={pulse.start.y}
            x2={pulse.end.x}
            y2={pulse.end.y}
          />
        ))}

        {nodes.map((node) => (
          <g key={node.id} className="node" transform={`translate(${node.x}, ${node.y})`}>
            {node.id === orchestratorId ? (
              <circle r={node.radius + 22} className="node-orbit" />
            ) : (
              <circle r={node.radius + 8} className="node-orbit" />
            )}
            <circle
              r={node.radius}
              className={node.id === orchestratorId ? 'node-core orchestrator' : 'node-core agent'}
              data-agent={node.id}
            />
            <text className="node-label" y={node.radius + 28} textAnchor="middle">
              {node.label}
            </text>
          </g>
        ))}
      </svg>
      <div className="canvas-overlay" aria-hidden>
        <div className="grid-lines" />
        <div className="grid-lines" />
      </div>
    </div>
  )
}
