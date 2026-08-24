import { User } from 'lucide-react'
import type { AgentSnapshot } from '../../lib/types'
import { ICON_MAP, TOOL_CATEGORY_ICON, iconNameForAgent } from '../../lib/icons'
import { ORCHESTRATOR_COLOR, colorForAgent, toolCategoryColor } from '../../lib/utils'
import { HUMAN_NODE_ID, type TreeNode } from '../../lib/treeLayout'

const HUMAN_COLOR = '#2dd4bf'

interface Props {
  node: TreeNode
  agent: AgentSnapshot | undefined
  isOrchestrator: boolean
  isSelected: boolean
  onHover: (id: string) => void
  onLeave: () => void
  onClick: (id: string) => void
}

export function TreeNodeView({ node, agent, isOrchestrator, isSelected, onHover, onLeave, onClick }: Props) {
  const isHuman = node.id === HUMAN_NODE_ID
  const fill = isOrchestrator ? ORCHESTRATOR_COLOR : isHuman ? HUMAN_COLOR : colorForAgent(node.id)
  const iconName = isOrchestrator ? 'bot' : iconNameForAgent(node.id, node.label)
  const IconComponent = isHuman ? User : ICON_MAP[iconName]
  const iconSize = node.radius * 1.1

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

      {/* Active agent halo */}
      {node.isActive && !isOrchestrator && (
        <circle r={node.radius + 14} fill={fill} opacity={0.22} filter="url(#softBlur)" className="agent-halo" />
      )}

      {/* State ring */}
      {node.state === 'spinning_up' && <circle r={node.radius + 6} className="node-ring spinning_up" />}
      {node.state === 'error' && <circle r={node.radius + 6} className="node-ring error" />}
      {node.state === 'running' && <circle r={node.radius + 6} className="node-ring running" style={{ stroke: fill }} />}

      {/* Stuck ring (running but stale liveness) */}
      {node.isActive && agent?.liveness === 'stale' && (
        <circle r={node.radius + 6} fill="none" stroke="#eab308" strokeWidth={3} opacity={0.8} />
      )}

      {/* Agent circle */}
      <circle
        r={node.radius}
        fill={fill}
        className={isOrchestrator ? 'node-core orchestrator' : 'node-core agent'}
        data-agent={node.id}
      />

      {/* Agent type icon */}
      {IconComponent && (
        <g transform={`translate(${-iconSize / 2}, ${-iconSize / 2})`}>
          <IconComponent size={iconSize} color="#fff" strokeWidth={1.5} />
        </g>
      )}

      {/* Liveness ring */}
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
      <text className="node-label" y={node.radius + 22} textAnchor="middle">
        {node.label}
      </text>

      {/* Tool indicators — active tool first, previously-used tools ghosted to the right */}
      {agent && agent.tools.length > 0 && (() => {
        const r = 14
        const gap = 8
        return (
          <g>
            {agent.tools.map((tool, i) => {
              const ToolIcon = TOOL_CATEGORY_ICON[tool.category] ?? ICON_MAP.brain
              const catColor = toolCategoryColor(tool.category)
              const x = node.radius + r + 6 + i * (r * 2 + gap)
              return (
                <g
                  key={tool.name}
                  className={`tool-indicator ${tool.active ? '' : 'tool-ghost'}`}
                  transform={`translate(${x}, 0)`}
                >
                  <circle r={r} fill={catColor} stroke="#fff" strokeWidth={1.5} opacity={tool.active ? 1 : 0.3} />
                  <g transform={`translate(${-r / 2}, ${-r / 2})`}>
                    <ToolIcon size={r} color="#fff" strokeWidth={2} opacity={tool.active ? 1 : 0.45} />
                  </g>
                </g>
              )
            })}
          </g>
        )
      })()}
    </g>
  )
}
