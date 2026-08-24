import type { ChatBubble } from '../../lib/types'
import { WIDTH, HEIGHT, type NodePosition } from '../../lib/orbitLayout'

interface Props {
  bubbles: ChatBubble[]
  nodeMap: Record<string, NodePosition>
}

const BUBBLE_WIDTH = 320
const BUBBLE_HEIGHT = 110
const GAP = 12

export function ChatBubbleLayer({ bubbles, nodeMap }: Props) {
  const visibleBubbles = bubbles.slice(0, 3)

  // Compute positions with collision avoidance
  const placed: Array<{ bx: number; by: number; node: NodePosition; bubble: ChatBubble }> = []
  const occupied: Array<{ x: number; y: number; w: number; h: number }> = []

  for (const bubble of visibleBubbles) {
    const node = nodeMap[bubble.agentId]
    if (!node) continue

    // Try right side first, then left side
    const candidates: Array<{ bx: number; by: number }> = []
    for (const side of ['right', 'left'] as const) {
      const baseX = side === 'right'
        ? node.x + node.radius + 14
        : node.x - node.radius - 14 - BUBBLE_WIDTH
      const clampedX = Math.max(4, Math.min(WIDTH - BUBBLE_WIDTH - 4, baseX))
      const baseY = Math.max(4, Math.min(HEIGHT - BUBBLE_HEIGHT - 4, node.y - BUBBLE_HEIGHT / 2))
      candidates.push({ bx: clampedX, by: baseY })
    }

    // Find first position that doesn't overlap existing bubbles
    let best: { bx: number; by: number } | null = null
    for (const c of candidates) {
      const overlaps = occupied.some(
        (o) => c.bx < o.x + o.w + GAP && c.bx + BUBBLE_WIDTH + GAP > o.x && c.by < o.y + o.h + GAP && c.by + BUBBLE_HEIGHT + GAP > o.y,
      )
      if (!overlaps) {
        best = c
        break
      }
    }

    // If all overlap, stack below the lowest bubble
    if (!best) {
      const maxY = Math.max(0, ...occupied.map((o) => o.y + o.h))
      best = { bx: candidates[0].bx, by: Math.min(maxY + GAP, HEIGHT - BUBBLE_HEIGHT - 4) }
    }

    occupied.push({ x: best.bx, y: best.by, w: BUBBLE_WIDTH, h: BUBBLE_HEIGHT })
    placed.push({ bx: best.bx, by: best.by, node, bubble })
  }

  return (
    <>
      {/* Connector lines from agent to bubble */}
      {placed.map(({ bx, by, node, bubble }) => {
        const cx = bx > node.x ? bx : bx + BUBBLE_WIDTH
        const cy = by + BUBBLE_HEIGHT / 2
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
            width={BUBBLE_WIDTH}
            height={BUBBLE_HEIGHT}
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
}
