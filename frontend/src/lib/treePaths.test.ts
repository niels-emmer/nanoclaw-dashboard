import { describe, it, expect } from 'vitest'
import { staticPath, edgePath, humanLinkPath } from './treePaths'
import type { TreeNode } from './treeLayout'

const node = (id: string, x: number, y: number, radius = 30, children: string[] = [], parentId: string | null = null): TreeNode => ({
  id,
  label: id,
  state: 'idle',
  opacity: 1,
  x,
  y,
  radius,
  depth: 0,
  parentId,
  children,
  isActive: false,
})

describe('staticPath', () => {
  it('returns the parent-child path for a question (parent -> child)', () => {
    const parent = node('orchestrator', 0, 0, 44, ['agent:researcher'])
    const child = node('agent:researcher', 280, 0)
    expect(staticPath(parent, child)).toBe(edgePath(parent, child))
  })

  it('returns the same parent-child path for a response (child -> parent)', () => {
    const parent = node('orchestrator', 0, 0, 44, ['agent:researcher'])
    const child = node('agent:researcher', 280, 0)
    // Response pulse is child -> parent, but must follow the static parent -> child path.
    expect(staticPath(child, parent)).toBe(edgePath(parent, child))
  })

  it('returns the vertical human-link path for human <-> agent', () => {
    const human = node('human', 280, 0, 34, [], 'agent:marvin')
    const marvin = node('agent:marvin', 280, 120)
    expect(staticPath(human, marvin)).toBe(humanLinkPath(human, marvin))
    expect(staticPath(marvin, human)).toBe(humanLinkPath(human, marvin))
  })

  it('returns null when there is no static edge (agent-to-agent)', () => {
    const a = node('agent:a', 280, 0)
    const b = node('agent:b', 280, 120)
    expect(staticPath(a, b)).toBeNull()
  })
})
