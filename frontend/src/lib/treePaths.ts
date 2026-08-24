import { HUMAN_NODE_ID, type TreeNode } from './treeLayout'

/** Smooth horizontal elbow curve from parent (right edge) to child (left edge). */
export function edgePath(start: TreeNode, end: TreeNode): string {
  const x1 = start.x + start.radius
  const y1 = start.y
  const x2 = end.x - end.radius
  const y2 = end.y
  const mid = (x1 + x2) / 2
  return `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`
}

/** Vertical connector between the human node (above) and its agent. */
export function humanLinkPath(human: TreeNode, agent: TreeNode): string {
  return `M ${human.x} ${human.y + human.radius} L ${agent.x} ${agent.y - agent.radius}`
}

/**
 * Return the path of the static edge between two nodes, if one exists, so an
 * active pulse follows the same path as the dotted (historic) line. Falls back
 * to null when there is no static edge (e.g. agent-to-agent).
 */
export function staticPath(a: TreeNode, b: TreeNode): string | null {
  if (a.children.includes(b.id)) return edgePath(a, b)
  if (b.children.includes(a.id)) return edgePath(b, a)
  if (a.id === HUMAN_NODE_ID && a.parentId === b.id) return humanLinkPath(a, b)
  if (b.id === HUMAN_NODE_ID && b.parentId === a.id) return humanLinkPath(b, a)
  return null
}
