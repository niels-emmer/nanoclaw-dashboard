import { useMemo, useState, useEffect } from 'react'
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
  Terminal,
  Wallet,
  Wrench,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { config } from '../lib/config'
import type { AgentSnapshot, AgentState, ChatBubble, EdgePulse, TopologyData } from '../lib/types'
import { colorForAgent, ORCHESTRATOR_COLOR, toolCategoryColor, formatElapsed, computeAgentOpacity } from '../lib/utils'

const WIDTH = 1000
const HEIGHT = 560
const CENTER = { x: WIDTH / 2, y: HEIGHT / 2 }

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

const TOOL_CATEGORY_ICON: Record<string, LucideIcon> = {
  executing: Terminal,
  reading: Search,
  writing: PenLine,
  network: Globe,
  waiting: Clock,
  thinking: BrainCircuit,
}

const FALLBACK_ICON_NAME = 'bot'

const ICON_KEYWORDS: [string, string][] = [
  ['eye', 'lookout'], ['eye', 'foresight'], ['eye', 'observer'], ['eye', 'spotter'],
  ['eye', 'oracle'], ['eye', 'vision'], ['eye', 'seer'], ['eye', 'scout'],
  ['compass', 'wayfinder'], ['compass', 'direction'], ['compass', 'compass'], ['compass', 'navigat'],
  ['compass', 'pilot'], ['compass', 'route'], ['compass', 'guide'], ['compass', 'path'],
  ['pen', 'chronicle'], ['pen', 'notebook'], ['pen', 'memoir'], ['pen', 'diary'],
  ['pen', 'journal'], ['pen', 'reporter'], ['pen', 'scribe'], ['pen', 'author'],
  ['pen', 'writer'], ['pen', 'editor'], ['pen', 'content'], ['pen', 'article'],
  ['pen', 'document'], ['pen', 'blog'], ['pen', 'log'], ['pen', 'record'], ['pen', 'copy'],
  ['hammer', 'fabricat'], ['hammer', 'construct'], ['hammer', 'hammer'], ['hammer', 'forge'],
  ['hammer', 'builder'], ['hammer', 'architect'], ['hammer', 'engineer'], ['hammer', 'developer'],
  ['hammer', 'craft'], ['hammer', 'maker'], ['hammer', 'smith'],
  ['shield', 'safeguard'], ['shield', 'sentinel'], ['shield', 'protector'], ['shield', 'defender'],
  ['shield', 'guardian'], ['shield', 'sentry'], ['shield', 'warden'], ['shield', 'shield'],
  ['shield', 'security'], ['shield', 'guard'], ['shield', 'watch'],
  ['book', 'librarian'], ['book', 'archivist'], ['book', 'investigator'], ['book', 'scientist'],
  ['book', 'scholar'], ['book', 'researcher'], ['book', 'research'], ['book', 'explorer'],
  ['book', 'analyst'], ['book', 'study'], ['book', 'learn'],
  ['backpack', 'hospitality'], ['backpack', 'itinerary'], ['backpack', 'vacation'], ['backpack', 'holiday'],
  ['backpack', 'journey'], ['backpack', 'voyage'], ['backpack', 'excursion'], ['backpack', 'travel'],
  ['backpack', 'concierge'], ['backpack', 'tour'], ['backpack', 'trip'], ['backpack', 'planner'],
  ['clipboard', 'supervisor'], ['clipboard', 'regulator'], ['clipboard', 'governor'], ['clipboard', 'operator'],
  ['clipboard', 'controller'], ['clipboard', 'control'], ['clipboard', 'manager'],
  ['message', 'spokesperson'], ['message', 'announcer'], ['message', 'broadcast'], ['message', 'messenger'],
  ['message', 'communicat'], ['message', 'liaison'], ['message', 'notify'],
  ['globe', 'connector'], ['globe', 'network'], ['globe', 'bridge'], ['globe', 'hub'], ['globe', 'link'],
  ['chart', 'dashboard'], ['chart', 'insight'], ['chart', 'statistics'], ['chart', 'analytic'],
  ['chart', 'metric'], ['chart', 'data'], ['chart', 'report'], ['chart', 'chart'],
  ['search', 'detective'], ['search', 'inspector'], ['search', 'examiner'], ['search', 'auditor'],
  ['search', 'sleuth'], ['search', 'checker'], ['search', 'verifier'], ['search', 'search'], ['search', 'find'],
  ['database', 'repository'], ['database', 'database'], ['database', 'archive'], ['database', 'storage'],
  ['database', 'vault'], ['database', 'cache'], ['database', 'keeper'], ['database', 'store'],
  ['brain', 'strategist'], ['brain', 'strategy'], ['brain', 'consultant'], ['brain', 'adviser'],
  ['brain', 'thinker'], ['brain', 'brain'],
  ['wrench', 'maintenance'], ['wrench', 'technician'], ['wrench', 'mechanic'], ['wrench', 'repair'],
  ['wrench', 'fixer'], ['wrench', 'fix'],
  ['palette', 'stylist'], ['palette', 'aesthetic'], ['palette', 'creative'], ['palette', 'designer'],
  ['palette', 'painter'], ['palette', 'artist'], ['palette', 'art'],
  ['music', 'podcast'], ['music', 'audio'], ['music', 'sound'], ['music', 'music'],
  ['clock', 'deadline'], ['clock', 'schedule'], ['clock', 'calendar'], ['clock', 'timer'], ['clock', 'clock'],
  ['wallet', 'budget'], ['wallet', 'invoice'], ['wallet', 'account'], ['wallet', 'finance'], ['wallet', 'calculator'],
  ['flask', 'validation'], ['flask', 'quality'], ['flask', 'experiment'], ['flask', 'test'],
]

interface FlowCanvasProps {
  orchestratorId: string
  agents: AgentSnapshot[]
  edges: EdgePulse[]
  bubbles: ChatBubble[]
  topology: TopologyData | null
  onAgentClick?: (agentId: string) => void
  selectedAgentId?: string | null
}

interface NodePosition {
  id: string
  x: number
  y: number
  radius: number
  label: string
  state: AgentState | 'unknown'
  opacity: number
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

export function FlowCanvas({ orchestratorId, agents, edges, bubbles, topology, onAgentClick, selectedAgentId }: FlowCanvasProps) {
  const [hoveredAgent, setHoveredAgent] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now())

  // Tick loop every 15s to update agent decay during lulls
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000)
    return () => clearInterval(timer)
  }, [])

  const agentOpacityMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const agent of agents) {
      map.set(
        agent.id,
        computeAgentOpacity(agent.lastUpdated, config.agentSolidMinutes, config.agentFadeMinutes, now),
      )
    }
    return map
  }, [agents, now])

  const nodes = useMemo<NodePosition[]>(() => {
    const activeAgents = agents.filter(
      (agent) => agent.id === orchestratorId || (agentOpacityMap.get(agent.id) ?? 1) > 0,
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
        opacity: agentOpacityMap.get(agent.id) ?? 1.0,
      }
    })

    return [orchestrator, ...spokes]
  }, [agents, orchestratorId, topology, agentOpacityMap])

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

        {/* Agent-to-agent edges */}
        {a2aEdges.map((edge) => {
          const src = nodeMap[edge.source.replace('agent:', '')]
          const tgt = nodeMap[edge.target.replace('agent:', '')]
          if (!src || !tgt) return null
          const s = edgePointOnCircle(src.x, src.y, tgt.x, tgt.y, src.radius)
          const e = edgePointOnCircle(tgt.x, tgt.y, src.x, src.y, tgt.radius)
          return (
            <line
              key={`a2a-${edge.source}-${edge.target}`}
              x1={s.x} y1={s.y} x2={e.x} y2={e.y}
              className="edge-a2a"
            />
          )
        })}

        {/* Base orchestrator→agent spines */}
        {baseEdges.map((edge) => {
          const start = nodeMap[edge.source]
          const end = nodeMap[edge.target]
          if (!start || !end) return null
          const s = edgePointOnCircle(start.x, start.y, end.x, end.y, start.radius)
          const e = edgePointOnCircle(end.x, end.y, start.x, start.y, end.radius)
          return (
            <line
              key={`spine-${edge.target}`}
              x1={s.x} y1={s.y} x2={e.x} y2={e.y}
              className="edge-spine"
            />
          )
        })}

        {/* Pulse edges */}
        {resolvedPulses.map((pulse) => {
          const s = edgePointOnCircle(pulse.start.x, pulse.start.y, pulse.end.x, pulse.end.y, pulse.start.radius)
          const e = edgePointOnCircle(pulse.end.x, pulse.end.y, pulse.start.x, pulse.start.y, pulse.end.radius)
          return (
            <line
              key={pulse.id}
              className={`edge-pulse pulse-${pulse.type}`}
              x1={s.x} y1={s.y} x2={e.x} y2={e.y}
            />
          )
        })}

        {/* Agent nodes */}
        {nodes.map((node) => {
          const isOrchestrator = node.id === orchestratorId
          const fill = isOrchestrator ? ORCHESTRATOR_COLOR : colorForAgent(node.id)
          const iconName = isOrchestrator ? 'bot' : iconNameForAgent(node.id, node.label)
          const IconComponent = ICON_MAP[iconName]
          const iconSize = node.radius * 1.15
          const agent = agentMap[node.id]
          const isSelected = selectedAgentId === node.id

          return (
            <g
              key={node.id}
              className={`node ${isSelected ? 'node-selected' : ''}`}
              transform={`translate(${node.x}, ${node.y})`}
              onMouseEnter={() => setHoveredAgent(node.id)}
              onMouseLeave={() => setHoveredAgent(null)}
              onClick={() => onAgentClick?.(node.id)}
              style={{
                cursor: onAgentClick ? 'pointer' : 'default',
                opacity: node.opacity,
              }}
            >
              {/* Selection ring */}
              {isSelected && (
                <circle r={node.radius + 10} fill="none" stroke="#fff" strokeWidth={2} opacity={0.5} strokeDasharray="4 4" />
              )}

              {/* Orchestrator glow */}
              {isOrchestrator && (
                <circle r={node.radius + 8} fill="url(#orchestratorGlow)" />
              )}

              {/* State ring — pulse for running, spin for startup, glow for error */}
              {node.state === 'spinning_up' && (
                <circle r={node.radius + 6} className="node-ring spinning_up" />
              )}
              {node.state === 'error' && (
                <circle r={node.radius + 6} className="node-ring error" />
              )}
              {node.state === 'running' && (
                <circle r={node.radius + 6} className="node-ring running" style={{ stroke: fill }} />
              )}

              {/* Agent circle */}
              <circle
                r={node.radius}
                fill={fill}
                className={isOrchestrator ? 'node-core orchestrator' : 'node-core agent'}
                data-agent={node.id}
              />

              {/* Agent type icon — inside the circle */}
              {IconComponent && (
                <g transform={`translate(${-iconSize / 2}, ${-iconSize / 2})`}>
                  <IconComponent size={iconSize} color="#fff" strokeWidth={1.5} />
                </g>
              )}

              {/* Liveness ring — dashed ring just inside the agent circle when stale/dead, hidden when alive */}
              {agent && (agent.liveness === 'stale' || agent.liveness === 'dead') && (
                <circle
                  r={node.radius - 4}
                  fill="none"
                  stroke={agent.liveness === 'stale' ? '#eab308' : '#ef4444'}
                  strokeWidth={3}
                  strokeDasharray="5 5"
                  opacity={0.8}
                />
              )}

              {/* Label */}
              <text className="node-label" y={node.radius + 24} textAnchor="middle">
                {node.label}
              </text>

              {/* Tool badge — below label, only when a tool is active */}
              {agent?.currentTool && (() => {
                const ToolIcon = TOOL_CATEGORY_ICON[agent.currentToolCategory] ?? BrainCircuit
                const catColor = toolCategoryColor(agent.currentToolCategory)
                const iconSize = 13
                const toolName = agent.currentTool.length > 12 ? agent.currentTool.slice(0, 11) + '…' : agent.currentTool
                return (
                  <g transform={`translate(0, ${node.radius + 40})`}>
                    <rect x={-40} y={-8} width={80} height={18} rx={9} fill={catColor} stroke="#fff" strokeWidth={1.5} opacity={0.95} />
                    <g transform={`translate(${-iconSize / 2 - 16}, ${-iconSize / 2 + 1})`}>
                      <ToolIcon size={iconSize} color="#fff" strokeWidth={2} />
                    </g>
                    <text x={6} y={5} textAnchor="middle" fill="#fff" fontSize={9} fontFamily="var(--mono)" fontWeight={500}>
                      {toolName}
                    </text>
                  </g>
                )
              })()}
            </g>
          )
        })}

        {/* Hover tooltip */}
        {hoveredData && hoveredAgent && (
          <foreignObject
            x={Math.min(nodeMap[hoveredAgent]?.x ?? CENTER.x + 80, WIDTH - 220)}
            y={Math.max((nodeMap[hoveredAgent]?.y ?? CENTER.y) - 90, 10)}
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
                <span className="tooltip-label">Uptime:</span>
                <span>{hoveredData.uptimeMs != null ? formatElapsed(hoveredData.uptimeMs) : 'unknown'}</span>
              </div>
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

        {/* Chat bubbles — non-overlapping, connected to agent nodes */}
        {(() => {
          const visibleBubbles = bubbles.slice(0, 3)
          const bubbleWidth = 320
          const bubbleHeight = 110
          const gap = 12

          // Compute positions with collision avoidance
          const placed: Array<{ bx: number; by: number; node: NodePosition; bubble: typeof bubbles[number] }> = []
          const occupied: Array<{ x: number; y: number; w: number; h: number }> = []

          for (const bubble of visibleBubbles) {
            const node = nodeMap[bubble.agentId]
            if (!node) continue

            // Try right side first, then left side
            const candidates: Array<{ bx: number; by: number }> = []
            for (const side of ['right', 'left'] as const) {
              const baseX = side === 'right'
                ? node.x + node.radius + 14
                : node.x - node.radius - 14 - bubbleWidth
              const clampedX = Math.max(4, Math.min(WIDTH - bubbleWidth - 4, baseX))
              const baseY = Math.max(4, Math.min(HEIGHT - bubbleHeight - 4, node.y - bubbleHeight / 2))
              candidates.push({ bx: clampedX, by: baseY })
            }

            // Find first position that doesn't overlap existing bubbles
            let best: { bx: number; by: number } | null = null
            for (const c of candidates) {
              const overlaps = occupied.some(
                (o) => c.bx < o.x + o.w + gap && c.bx + bubbleWidth + gap > o.x && c.by < o.y + o.h + gap && c.by + bubbleHeight + gap > o.y,
              )
              if (!overlaps) {
                best = c
                break
              }
            }

            // If all overlap, stack below the lowest bubble
            if (!best) {
              const maxY = Math.max(0, ...occupied.map((o) => o.y + o.h))
              best = { bx: candidates[0].bx, by: Math.min(maxY + gap, HEIGHT - bubbleHeight - 4) }
            }

            occupied.push({ x: best.bx, y: best.by, w: bubbleWidth, h: bubbleHeight })
            placed.push({ bx: best.bx, by: best.by, node, bubble })
          }

          return (
            <>
              {/* Connector lines from agent to bubble */}
              {placed.map(({ bx, by, node, bubble }) => {
                const cx = bx > node.x ? bx : bx + bubbleWidth
                const cy = by + bubbleHeight / 2
                const nx = node.x + (bx > node.x ? node.radius : -node.radius)
                const ny = node.y
                return (
                  <line
                    key={`conn-${bubble.id}`}
                    x1={nx} y1={ny} x2={cx} y2={cy}
                    stroke="rgba(255,255,255,0.25)"
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                    strokeLinecap="round"
                  />
                )
              })}

              {/* Bubbles */}
              {placed.map(({ bx, by, bubble }, idx) => {
                const node = nodeMap[bubble.agentId]!
                const isQuestion = bubble.type === 'question'
                const fromLabel = isQuestion ? bubble.fromLabel : bubble.toLabel
                const tailSide = bx > node.x ? 'left' : 'right'
                const opacity = idx === 0 ? 0.97 : idx === 1 ? 0.92 : 0.87

                return (
                  <foreignObject
                    key={bubble.id}
                    x={bx}
                    y={by}
                    width={bubbleWidth}
                    height={bubbleHeight}
                    className="chat-bubble-fo"
                    style={{ opacity }}
                  >
                    <div className={`chat-bubble tail-${tailSide}`}>
                      <div className="bubble-header">
                        <span className="bubble-direction">{isQuestion ? '→' : '←'}</span>
                        <span className="bubble-from">from: {fromLabel}</span>
                      </div>
                      <div className="bubble-divider" />
                      <div className="bubble-lines">
                        {bubble.lines.slice(0, 2).map((line, i) => (
                          <span key={i} className="bubble-line">{line}</span>
                        ))}
                      </div>
                    </div>
                  </foreignObject>
                )
              })}
            </>
          )
        })()}
      </svg>
      <div className="canvas-overlay" aria-hidden>
        <div className="grid-lines" />
        <div className="grid-lines" />
      </div>
    </div>
  )
}
