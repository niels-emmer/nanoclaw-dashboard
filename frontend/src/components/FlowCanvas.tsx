import { useMemo } from 'react'
import {
  Backpack,
  BarChart3,
  BookOpen,
  Bot,
  BrainCircuit,
  ClipboardList,
  Clock,
  Compass,
  Database,
  Eye,
  FlaskConical,
  Globe,
  Hammer,
  MessageSquare,
  Music,
  Palette,
  PenLine,
  Search,
  Shield,
  Wallet,
  Wrench,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import type { AgentSnapshot, ChatBubble, EdgePulse } from '../lib/types'
import { colorForAgent } from '../lib/utils'

const WIDTH = 1000
const HEIGHT = 560
const CENTER = { x: WIDTH / 2, y: HEIGHT / 2 }

const ORCHESTRATOR_COLOR = '#e8c547'

const ICON_MAP: Record<string, LucideIcon> = {
  backpack: Backpack,
  chart: BarChart3,
  book: BookOpen,
  bot: Bot,
  brain: BrainCircuit,
  clipboard: ClipboardList,
  clock: Clock,
  compass: Compass,
  database: Database,
  eye: Eye,
  flask: FlaskConical,
  globe: Globe,
  hammer: Hammer,
  message: MessageSquare,
  music: Music,
  palette: Palette,
  pen: PenLine,
  search: Search,
  shield: Shield,
  wallet: Wallet,
  wrench: Wrench,
}

const FALLBACK_ICON_NAME = 'bot'

const ICON_KEYWORDS: [string, string][] = [
  ['eye', 'lookout'],
  ['eye', 'foresight'],
  ['eye', 'observer'],
  ['eye', 'spotter'],
  ['eye', 'oracle'],
  ['eye', 'vision'],
  ['eye', 'seer'],
  ['eye', 'scout'],

  ['compass', 'wayfinder'],
  ['compass', 'direction'],
  ['compass', 'compass'],
  ['compass', 'navigat'],
  ['compass', 'pilot'],
  ['compass', 'route'],
  ['compass', 'guide'],
  ['compass', 'path'],

  ['pen', 'chronicle'],
  ['pen', 'notebook'],
  ['pen', 'memoir'],
  ['pen', 'diary'],
  ['pen', 'journal'],
  ['pen', 'reporter'],
  ['pen', 'scribe'],
  ['pen', 'author'],
  ['pen', 'writer'],
  ['pen', 'editor'],
  ['pen', 'content'],
  ['pen', 'article'],
  ['pen', 'document'],
  ['pen', 'blog'],
  ['pen', 'log'],
  ['pen', 'record'],
  ['pen', 'copy'],

  ['hammer', 'fabricat'],
  ['hammer', 'construct'],
  ['hammer', 'hammer'],
  ['hammer', 'forge'],
  ['hammer', 'builder'],
  ['hammer', 'architect'],
  ['hammer', 'engineer'],
  ['hammer', 'developer'],
  ['hammer', 'craft'],
  ['hammer', 'maker'],
  ['hammer', 'smith'],

  ['shield', 'safeguard'],
  ['shield', 'sentinel'],
  ['shield', 'protector'],
  ['shield', 'defender'],
  ['shield', 'guardian'],
  ['shield', 'sentry'],
  ['shield', 'warden'],
  ['shield', 'shield'],
  ['shield', 'security'],
  ['shield', 'guard'],
  ['shield', 'watch'],

  ['book', 'librarian'],
  ['book', 'archivist'],
  ['book', 'investigator'],
  ['book', 'scientist'],
  ['book', 'scholar'],
  ['book', 'researcher'],
  ['book', 'research'],
  ['book', 'explorer'],
  ['book', 'analyst'],
  ['book', 'study'],
  ['book', 'learn'],

  ['backpack', 'hospitality'],
  ['backpack', 'itinerary'],
  ['backpack', 'vacation'],
  ['backpack', 'holiday'],
  ['backpack', 'journey'],
  ['backpack', 'voyage'],
  ['backpack', 'excursion'],
  ['backpack', 'travel'],
  ['backpack', 'concierge'],
  ['backpack', 'tour'],
  ['backpack', 'trip'],
  ['backpack', 'planner'],

  ['clipboard', 'supervisor'],
  ['clipboard', 'regulator'],
  ['clipboard', 'governor'],
  ['clipboard', 'operator'],
  ['clipboard', 'controller'],
  ['clipboard', 'control'],
  ['clipboard', 'manager'],

  ['message', 'spokesperson'],
  ['message', 'announcer'],
  ['message', 'broadcast'],
  ['message', 'messenger'],
  ['message', 'communicat'],
  ['message', 'liaison'],
  ['message', 'notify'],

  ['globe', 'connector'],
  ['globe', 'network'],
  ['globe', 'bridge'],
  ['globe', 'hub'],
  ['globe', 'link'],

  ['chart', 'dashboard'],
  ['chart', 'insight'],
  ['chart', 'statistics'],
  ['chart', 'analytic'],
  ['chart', 'metric'],
  ['chart', 'data'],
  ['chart', 'report'],
  ['chart', 'chart'],

  ['search', 'detective'],
  ['search', 'inspector'],
  ['search', 'examiner'],
  ['search', 'auditor'],
  ['search', 'sleuth'],
  ['search', 'checker'],
  ['search', 'verifier'],
  ['search', 'search'],
  ['search', 'find'],

  ['database', 'repository'],
  ['database', 'database'],
  ['database', 'archive'],
  ['database', 'storage'],
  ['database', 'vault'],
  ['database', 'cache'],
  ['database', 'keeper'],
  ['database', 'store'],

  ['brain', 'strategist'],
  ['brain', 'strategy'],
  ['brain', 'consultant'],
  ['brain', 'adviser'],
  ['brain', 'thinker'],
  ['brain', 'brain'],

  ['wrench', 'maintenance'],
  ['wrench', 'technician'],
  ['wrench', 'mechanic'],
  ['wrench', 'repair'],
  ['wrench', 'fixer'],
  ['wrench', 'fix'],

  ['palette', 'stylist'],
  ['palette', 'aesthetic'],
  ['palette', 'creative'],
  ['palette', 'designer'],
  ['palette', 'painter'],
  ['palette', 'artist'],
  ['palette', 'art'],

  ['music', 'podcast'],
  ['music', 'audio'],
  ['music', 'sound'],
  ['music', 'music'],

  ['clock', 'deadline'],
  ['clock', 'schedule'],
  ['clock', 'calendar'],
  ['clock', 'timer'],
  ['clock', 'clock'],

  ['wallet', 'budget'],
  ['wallet', 'invoice'],
  ['wallet', 'account'],
  ['wallet', 'finance'],
  ['wallet', 'calculator'],

  ['flask', 'validation'],
  ['flask', 'quality'],
  ['flask', 'experiment'],
  ['flask', 'test'],
]

interface FlowCanvasProps {
  orchestratorId: string
  agents: AgentSnapshot[]
  edges: EdgePulse[]
  bubbles: ChatBubble[]
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

function iconNameForAgent(nodeId: string, label: string): string {
  const text = `${nodeId} ${label}`.toLowerCase().replace(/[_-]+/g, ' ')
  for (const [name, keyword] of ICON_KEYWORDS) {
    if (text.includes(keyword)) return name
  }
  return FALLBACK_ICON_NAME
}

export function FlowCanvas({ orchestratorId, agents, edges, bubbles }: FlowCanvasProps) {
  const nodes = useMemo<NodePosition[]>(() => {
    const nonOrchestratorAgents = agents.filter((agent) => agent.id !== orchestratorId)
    const agentCount = Math.max(nonOrchestratorAgents.length, 1)
    const orbit = Math.min(WIDTH, HEIGHT) / 2.7
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
          const iconName = isOrchestrator ? 'bot' : iconNameForAgent(node.id, node.label)
          const IconComponent = ICON_MAP[iconName]
          const iconSize = node.radius * 1.15
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
              {IconComponent && (
                <g transform={`translate(${-iconSize / 2}, ${-iconSize / 2})`}>
                  <IconComponent size={iconSize} color="#fff" strokeWidth={1.5} />
                </g>
              )}
              <text className="node-label" y={node.radius + 24} textAnchor="middle">
                {node.label}
              </text>
            </g>
          )
        })}
        {bubbles.map((bubble) => {
          const node = nodeMap[bubble.agentId]
          if (!node) return null
          const isQuestion = bubble.type === 'question'
          // Place bubble to the right of the agent; flip to left if too close to edge
          let bx = node.x + node.radius + 14
          if (bx + 220 > WIDTH - 10) {
            bx = node.x - node.radius - 14 - 220
          }
          const by = Math.max(8, Math.min(HEIGHT - 78, node.y - 32))
          const tailSide = bx > node.x ? 'left' : 'right'
          const accentColor =
            bubble.type === 'question' ? '#a78bfa' : bubble.type === 'response' ? '#7860d8' : '#c084fc'
          return (
            <foreignObject
              key={bubble.id}
              x={bx}
              y={by}
              width={220}
              height={70}
              className="chat-bubble-fo"
            >
              <div
                className={`chat-bubble tail-${tailSide}`}
                style={{ borderLeftColor: accentColor }}
              >
                <span className="bubble-direction">{isQuestion ? '→' : '←'}</span>
                <span className="bubble-text">{bubble.text}</span>
              </div>
            </foreignObject>
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
