import type { AgentSnapshot } from '../../lib/types'
import { ICON_MAP, TOOL_CATEGORY_ICON, iconNameForAgent } from '../../lib/icons'
import { ORCHESTRATOR_COLOR, colorForAgent, toolCategoryColor } from '../../lib/utils'
import type { NodePosition } from '../../lib/orbitLayout'

interface Props {
  node: NodePosition
  agent: AgentSnapshot | undefined
  isOrchestrator: boolean
  isSelected: boolean
  onHover: (id: string) => void
  onLeave: () => void
  onClick: (id: string) => void
}

export function AgentNode({ node, agent, isOrchestrator, isSelected, onHover, onLeave, onClick }: Props) {
  const fill = isOrchestrator ? ORCHESTRATOR_COLOR : colorForAgent(node.id)
  const iconName = isOrchestrator ? 'bot' : iconNameForAgent(node.id, node.label)
  const IconComponent = ICON_MAP[iconName]
  const iconSize = node.radius * 1.15

  return (
    <g
      className={`node ${isSelected ? 'node-selected' : ''}`}
      transform={`translate(${node.x}, ${node.y})`}
      onMouseEnter={() => onHover(node.id)}
      onMouseLeave={onLeave}
      onClick={() => onClick(node.id)}
      style={{ cursor: 'pointer', opacity: node.opacity }}
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

      {/* Liveness ring — dashed ring just inside the agent circle when stale/dead */}
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
        const ToolIcon = TOOL_CATEGORY_ICON[agent.currentToolCategory] ?? ICON_MAP.brain
        const catColor = toolCategoryColor(agent.currentToolCategory)
        const iconSize = 13
        const rawName = agent.currentTool.toLowerCase()
        const toolName = rawName.length > 14 ? rawName.slice(0, 13) + '…' : rawName
        return (
          <g transform={`translate(0, ${node.radius + 40})`}>
            <rect x={-40} y={-8} width={80} height={18} rx={9} fill={catColor} stroke="#fff" strokeWidth={1.5} opacity={0.95} />
            <g transform={`translate(${-36}, ${-iconSize / 2 + 1})`}>
              <ToolIcon size={iconSize} color="#fff" strokeWidth={2} />
            </g>
            <text x={-20} y={5} textAnchor="start" fill="#fff" fontSize={9} fontFamily="var(--mono)" fontWeight={500}>
              {toolName}
            </text>
          </g>
        )
      })()}
    </g>
  )
}
