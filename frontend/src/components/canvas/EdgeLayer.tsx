import type { EdgePulse } from '../../lib/types'
import { edgePointOnCircle, type NodePosition } from '../../lib/orbitLayout'

interface Props {
  baseEdges: Array<{ source: string; target: string }>
  a2aEdges: Array<{ source: string; target: string }>
  resolvedPulses: Array<EdgePulse & { start: NodePosition; end: NodePosition }>
  nodeMap: Record<string, NodePosition>
}

export function EdgeLayer({ baseEdges, a2aEdges, resolvedPulses, nodeMap }: Props) {
  return (
    <>
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
    </>
  )
}
