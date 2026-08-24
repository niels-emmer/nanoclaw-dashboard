import type { TelemetryEvent } from './types'

export type FeedItem = TelemetryEvent & { count?: number }

// Clean conversation stream: messages + tool calls. Delivery/topology noise dropped.
const VISIBLE_TYPES = new Set(['question', 'response', 'activity_update', 'approval_pending', 'agent_status'])

export function isError(event: TelemetryEvent): boolean {
  return event.payload.status === 'error' || event.agent_state === 'error'
}

// Signalling-only activity_update cards (e.g. "Message completed") carry no
// current_tool — they add noise without content. Drop them.
function isSignallingOnly(event: TelemetryEvent): boolean {
  return event.type === 'activity_update' && !event.payload.current_tool
}

/**
 * Build the activity feed: filter to visible types, drop signalling-only cards,
 * and collapse consecutive same-agent/same-tool activity into one card with a count.
 */
export function buildActivityFeed(events: TelemetryEvent[]): FeedItem[] {
  const visible = events
    .filter((e) => VISIBLE_TYPES.has(e.type))
    .filter((e) => !(e.type === 'agent_status' && !isError(e))) // drop benign status, keep errors
    .filter((e) => !isSignallingOnly(e)) // drop "Message completed" style signals
    .slice(0, 60)

  const collapsed: FeedItem[] = []
  for (const e of visible) {
    if (e.type === 'activity_update' && e.payload.current_tool) {
      const last = collapsed[collapsed.length - 1]
      if (
        last &&
        last.type === 'activity_update' &&
        last.source === e.source &&
        last.payload.current_tool === e.payload.current_tool
      ) {
        last.count = (last.count ?? 1) + 1
        continue
      }
    }
    collapsed.push({ ...e, count: 1 })
  }
  return collapsed
}
