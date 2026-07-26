import { useMemo } from 'react'

import type { AgentSnapshot, EdgePulse } from '../lib/types'
import { colorForAgent } from '../lib/utils'

const WIDTH = 1000
const HEIGHT = 560
const CENTER = { x: WIDTH / 2, y: HEIGHT / 2 }

const ORCHESTRATOR_COLOR = '#e8c547'

const AGENT_ICONS: Record<string, string> = {
  orchestrator: '\u{1F916}',
  seer: '\u{1F441}',
  navigator: '\u{1F9ED}',
  scribe: '\u{270D}',
  smith: '\u{1F528}',
  warden: '\u{1F6E1}',
}

const FALLBACK_ICON = '\u2699'

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

function edgePointOnCircle(
  cx: number, cy: number,
  tx: number, ty: number,
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

function iconForAgent(label: string): string {
  const key = label.toLowerCase().replace(/^agent:/, '')
  return AGENT_ICONS[key] ?? FALLBACK_ICON
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
            <stop offset="0%" stopColor={ORCHESTRATOR_COLOR} stopOpacity="0.4" />
            <stop offset="100%" stopColor={ORCHESTRATOR_COLOR} stopOpacity="0" />
          </radialGradient>
        </defs>

        {baseEdges.map((edge) => {
          const start = nodeMap[edge.source]
          const end = nodeMap[edge.target]
          if (!start || !end) return null
          const s = edgePointOnCircle(start.x, start.y, end.x, end.y, start.radius)
          const e = edgePointOnCircle(end.x, end.y, start.x, start.y, end.radius)
          return (
            <line
              key={`spine-${edge.target}`}
              x1={s.x}
              y1={s.y}
              x2={e.x}
              y2={e.y}
              className="edge-spine"
            />
          )
        })}

        {resolvedPulses.map((pulse) => {
          const s = edgePointOnCircle(pulse.start.x, pulse.start.y, pulse.end.x, pulse.end.y, pulse.start.radius)
          const e = edgePointOnCircle(pulse.end.x, pulse.end.y, pulse.start.x, pulse.start.y, pulse.end.radius)
          return (
            <line
              key={pulse.id}
              className={`edge-pulse pulse-${pulse.type}`}
              x1={s.x}
              y1={s.y}
              x2={e.x}
              y2={e.y}
            />
          )
        })}

        {nodes.map((node) => {
          const isOrchestrator = node.id === orchestratorId
          const fill = isOrchestrator ? ORCHESTRATOR_COLOR : colorForAgent(node.id)
          const icon = isOrchestrator
            ? AGENT_ICONS.orchestrator
            : iconForAgent(node.label)
          return (
            <g key={node.id} className="node" transform={`translate(${node.x}, ${node.y})`}>
              {isOrchestrator && (
                <circle r={node.radius + 8} fill="url(#orchestratorGlow)" />
              )}
              <circle
                r={node.radius}
                fill={fill}
                className={isOrchestrator ? 'node-core orchestrator' : 'node-core agent'}
                data-agent={node.id}
              />
              <text
                className="node-icon"
                textAnchor="middle"
                dominantBaseline="central"
                y={-2}
                aria-hidden
              >
                {icon}
              </text>
              <text className="node-label" y={node.radius + 24} textAnchor="middle">
                {node.label}
              </text>
            </g>
          )
        })}
      </svg>
      <div className="canvas-overlay" aria-hidden>
        <div className="grid-lines" />
        <div className="grid-lines" />
      </div>
    </div>
  )
}
