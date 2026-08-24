import type { EdgePulse } from '../../lib/types'
import type { TreeNode } from '../../lib/treeLayout'

interface ResolvedPulse extends EdgePulse {
  start: TreeNode
  end: TreeNode
}

interface Props {
  nodes: TreeNode[]
  nodeMap: Record<string, TreeNode>
  pulses: ResolvedPulse[]
}

/** Smooth horizontal elbow curve from parent (right edge) to child (left edge). */
function edgePath(start: TreeNode, end: TreeNode): string {
  const x1 = start.x + start.radius
  const y1 = start.y
  const x2 = end.x - end.radius
  const y2 = end.y
  const mid = (x1 + x2) / 2
  return `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`
}

export function TreeEdge({ nodes, nodeMap, pulses }: Props) {
  return (
    <>
      {/* Parent-child edges */}
      {nodes.map((node) => {
        if (!node.parentId) return null
        const parent = nodeMap[node.parentId]
        if (!parent) return null
        return (
          <path
            key={`edge-${parent.id}-${node.id}`}
            d={edgePath(parent, node)}
            className="tree-edge"
            fill="none"
          />
        )
      })}

      {/* Live communication pulses */}
      {pulses.map((pulse) => (
        <path
          key={pulse.id}
          d={edgePath(pulse.start, pulse.end)}
          className={`edge-pulse pulse-${pulse.type}`}
          fill="none"
        />
      ))}
    </>
  )
}
