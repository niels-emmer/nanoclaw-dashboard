import type { EdgePulse } from '../../lib/types'
import { HUMAN_NODE_ID, type TreeNode } from '../../lib/treeLayout'
import { edgePath, staticPath } from '../../lib/treePaths'

interface ResolvedPulse extends EdgePulse {
  start: TreeNode
  end: TreeNode
}

interface Props {
  nodes: TreeNode[]
  nodeMap: Record<string, TreeNode>
  pulses: ResolvedPulse[]
}

export function TreeEdge({ nodes, nodeMap, pulses }: Props) {
  return (
    <>
      {/* Parent-child edges */}
      {nodes.map((node) => {
        if (!node.parentId) return null
        const parent = nodeMap[node.parentId]
        if (!parent) return null
        // Human node connects vertically to its agent (it sits directly above).
        if (node.id === HUMAN_NODE_ID) {
          return (
            <line
              key="human-link"
              x1={node.x} y1={node.y + node.radius}
              x2={parent.x} y2={parent.y - parent.radius}
              className="human-link"
            />
          )
        }
        return (
          <path
            key={`edge-${parent.id}-${node.id}`}
            d={edgePath(parent, node)}
            className="tree-edge"
            fill="none"
          />
        )
      })}

      {/* Live communication pulses — follow the same path as the static edge */}
      {pulses.map((pulse) => {
        const d = staticPath(pulse.start, pulse.end) ?? edgePath(pulse.start, pulse.end)
        return (
          <path
            key={pulse.id}
            d={d}
            className={`edge-pulse pulse-${pulse.type}`}
            fill="none"
          />
        )
      })}
    </>
  )
}
