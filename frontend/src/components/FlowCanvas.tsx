import { useMemo } from 'react'

import type { AgentSnapshot, EdgePulse } from '../lib/types'
import { colorForAgent } from '../lib/utils'

const WIDTH = 1000
const HEIGHT = 560
const CENTER = { x: WIDTH / 2, y: HEIGHT / 2 }

const ORCHESTRATOR_COLOR = '#e8c547'
const ORCHESTRATOR_ICON = '\u{1F916}'
const FALLBACK_ICON = '\u2699'

const ICON_KEYWORDS: [string, string][] = [
  ['\u{1F441}', 'lookout'],
  ['\u{1F441}', 'foresight'],
  ['\u{1F441}', 'observer'],
  ['\u{1F441}', 'spotter'],
  ['\u{1F441}', 'oracle'],
  ['\u{1F441}', 'vision'],
  ['\u{1F441}', 'seer'],
  ['\u{1F441}', 'scout'],

  ['\u{1F9ED}', 'wayfinder'],
  ['\u{1F9ED}', 'direction'],
  ['\u{1F9ED}', 'compass'],
  ['\u{1F9ED}', 'navigat'],
  ['\u{1F9ED}', 'pilot'],
  ['\u{1F9ED}', 'route'],
  ['\u{1F9ED}', 'guide'],
  ['\u{1F9ED}', 'path'],

  ['\u{270D}', 'chronicle'],
  ['\u{270D}', 'notebook'],
  ['\u{270D}', 'memoir'],
  ['\u{270D}', 'diary'],
  ['\u{270D}', 'journal'],
  ['\u{270D}', 'reporter'],
  ['\u{270D}', 'scribe'],
  ['\u{270D}', 'author'],
  ['\u{270D}', 'writer'],
  ['\u{270D}', 'editor'],
  ['\u{270D}', 'content'],
  ['\u{270D}', 'article'],
  ['\u{270D}', 'document'],
  ['\u{270D}', 'blog'],
  ['\u{270D}', 'log'],
  ['\u{270D}', 'record'],
  ['\u{270D}', 'copy'],

  ['\u{1F528}', 'fabricat'],
  ['\u{1F528}', 'construct'],
  ['\u{1F528}', 'hammer'],
  ['\u{1F528}', 'forge'],
  ['\u{1F528}', 'builder'],
  ['\u{1F528}', 'architect'],
  ['\u{1F528}', 'engineer'],
  ['\u{1F528}', 'developer'],
  ['\u{1F528}', 'craft'],
  ['\u{1F528}', 'maker'],
  ['\u{1F528}', 'smith'],

  ['\u{1F6E1}', 'safeguard'],
  ['\u{1F6E1}', 'sentinel'],
  ['\u{1F6E1}', 'protector'],
  ['\u{1F6E1}', 'defender'],
  ['\u{1F6E1}', 'guardian'],
  ['\u{1F6E1}', 'sentry'],
  ['\u{1F6E1}', 'warden'],
  ['\u{1F6E1}', 'shield'],
  ['\u{1F6E1}', 'security'],
  ['\u{1F6E1}', 'guard'],
  ['\u{1F6E1}', 'watch'],

  ['\u{1F4DA}', 'librarian'],
  ['\u{1F4DA}', 'archivist'],
  ['\u{1F4DA}', 'investigator'],
  ['\u{1F4DA}', 'scientist'],
  ['\u{1F4DA}', 'scholar'],
  ['\u{1F4DA}', 'researcher'],
  ['\u{1F4DA}', 'research'],
  ['\u{1F4DA}', 'explorer'],
  ['\u{1F4DA}', 'analyst'],
  ['\u{1F4DA}', 'study'],
  ['\u{1F4DA}', 'learn'],

  ['\u{1F9F3}', 'hospitality'],
  ['\u{1F9F3}', 'itinerary'],
  ['\u{1F9F3}', 'vacation'],
  ['\u{1F9F3}', 'holiday'],
  ['\u{1F9F3}', 'journey'],
  ['\u{1F9F3}', 'voyage'],
  ['\u{1F9F3}', 'excursion'],
  ['\u{1F9F3}', 'travel'],
  ['\u{1F9F3}', 'concierge'],
  ['\u{1F9F3}', 'tour'],
  ['\u{1F9F3}', 'trip'],
  ['\u{1F9F3}', 'planner'],

  ['\u{1F4CB}', 'supervisor'],
  ['\u{1F4CB}', 'regulator'],
  ['\u{1F4CB}', 'governor'],
  ['\u{1F4CB}', 'operator'],
  ['\u{1F4CB}', 'controller'],
  ['\u{1F4CB}', 'control'],
  ['\u{1F4CB}', 'manager'],

  ['\u{1F4E3}', 'spokesperson'],
  ['\u{1F4E3}', 'announcer'],
  ['\u{1F4E3}', 'broadcast'],
  ['\u{1F4E3}', 'messenger'],
  ['\u{1F4E3}', 'communicat'],
  ['\u{1F4E3}', 'liaison'],
  ['\u{1F4E3}', 'notify'],

  ['\u{1F310}', 'connector'],
  ['\u{1F310}', 'network'],
  ['\u{1F310}', 'bridge'],
  ['\u{1F310}', 'hub'],
  ['\u{1F310}', 'link'],

  ['\u{1F4CA}', 'dashboard'],
  ['\u{1F4CA}', 'insight'],
  ['\u{1F4CA}', 'statistics'],
  ['\u{1F4CA}', 'analytic'],
  ['\u{1F4CA}', 'metric'],
  ['\u{1F4CA}', 'data'],
  ['\u{1F4CA}', 'report'],
  ['\u{1F4CA}', 'chart'],

  ['\u{1F50D}', 'detective'],
  ['\u{1F50D}', 'inspector'],
  ['\u{1F50D}', 'examiner'],
  ['\u{1F50D}', 'auditor'],
  ['\u{1F50D}', 'sleuth'],
  ['\u{1F50D}', 'checker'],
  ['\u{1F50D}', 'verifier'],
  ['\u{1F50D}', 'search'],
  ['\u{1F50D}', 'find'],

  ['\u{1F5C2}', 'repository'],
  ['\u{1F5C2}', 'database'],
  ['\u{1F5C2}', 'archive'],
  ['\u{1F5C2}', 'storage'],
  ['\u{1F5C2}', 'vault'],
  ['\u{1F5C2}', 'cache'],
  ['\u{1F5C2}', 'keeper'],
  ['\u{1F5C2}', 'store'],

  ['\u{1F9E0}', 'strategist'],
  ['\u{1F9E0}', 'strategy'],
  ['\u{1F9E0}', 'consultant'],
  ['\u{1F9E0}', 'adviser'],
  ['\u{1F9E0}', 'thinker'],
  ['\u{1F9E0}', 'brain'],

  ['\u{1F527}', 'maintenance'],
  ['\u{1F527}', 'technician'],
  ['\u{1F527}', 'mechanic'],
  ['\u{1F527}', 'repair'],
  ['\u{1F527}', 'fixer'],
  ['\u{1F527}', 'fix'],

  ['\u{1F3A8}', 'stylist'],
  ['\u{1F3A8}', 'aesthetic'],
  ['\u{1F3A8}', 'creative'],
  ['\u{1F3A8}', 'designer'],
  ['\u{1F3A8}', 'painter'],
  ['\u{1F3A8}', 'artist'],
  ['\u{1F3A8}', 'art'],

  ['\u{1F3B5}', 'podcast'],
  ['\u{1F3B5}', 'audio'],
  ['\u{1F3B5}', 'sound'],
  ['\u{1F3B5}', 'music'],

  ['\u{23F0}', 'deadline'],
  ['\u{23F0}', 'schedule'],
  ['\u{23F0}', 'calendar'],
  ['\u{23F0}', 'timer'],
  ['\u{23F0}', 'clock'],

  ['\u{1F4B0}', 'budget'],
  ['\u{1F4B0}', 'invoice'],
  ['\u{1F4B0}', 'account'],
  ['\u{1F4B0}', 'finance'],
  ['\u{1F4B0}', 'calculator'],

  ['\u{1F9EA}', 'validation'],
  ['\u{1F9EA}', 'quality'],
  ['\u{1F9EA}', 'experiment'],
  ['\u{1F9EA}', 'test'],
]

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

function iconForAgent(nodeId: string, label: string): string {
  const text = `${nodeId} ${label}`.toLowerCase().replace(/[_-]+/g, ' ')
  for (const [icon, keyword] of ICON_KEYWORDS) {
    if (text.includes(keyword)) return icon
  }
  return FALLBACK_ICON
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
            ? ORCHESTRATOR_ICON
            : iconForAgent(node.id, node.label)
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
