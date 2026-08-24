import type { AgentSnapshot } from '../../lib/types'
import { formatElapsed } from '../../lib/utils'
import { WIDTH, CENTER, type NodePosition } from '../../lib/orbitLayout'

interface Props {
  hoveredAgent: string | null
  hoveredData: AgentSnapshot | null
  nodeMap: Record<string, NodePosition>
}

export function TooltipLayer({ hoveredAgent, hoveredData, nodeMap }: Props) {
  if (!hoveredData || !hoveredAgent) return null

  const node = nodeMap[hoveredAgent]
  const x = Math.min(node?.x ?? CENTER.x + 80, WIDTH - 220)
  const y = Math.max((node?.y ?? CENTER.y) - 90, 10)
  const height = hoveredData.skills.length > 0 ? 120 : 90

  return (
    <foreignObject
      x={x}
      y={y}
      width={200}
      height={height}
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
  )
}
