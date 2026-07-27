import type { TelemetryEvent } from '../lib/types'
import { colorForAgent, colorForEventType, formatTime, readableNodeLabel } from '../lib/utils'

interface Props {
  events: TelemetryEvent[]
}

function statusIcon(event: TelemetryEvent): { icon: string; color: string; label: string } {
  const p = event.payload

  // Delivery status
  if (event.type === 'delivery_update') {
    if (p.delivery_status === 'delivered') return { icon: '✓', color: '#22c55e', label: 'delivered' }
    if (p.delivery_status === 'failed') return { icon: '✗', color: '#ef4444', label: 'failed' }
    return { icon: '⋯', color: '#eab308', label: 'pending' }
  }

  // Approval pending
  if (event.type === 'approval_pending') {
    return { icon: '⚑', color: '#a855f7', label: 'approval' }
  }

  // Activity update
  if (event.type === 'activity_update') {
    if (p.status === 'processing') return { icon: '⟳', color: '#38bdf8', label: 'processing' }
    if (p.status === 'completed') return { icon: '✓', color: '#22c55e', label: 'completed' }
    if (p.status === 'failed') return { icon: '✗', color: '#ef4444', label: 'failed' }
    return { icon: '⋯', color: '#eab308', label: p.status }
  }

  // Question / response / agent_status
  return { icon: '', color: '', label: '' }
}

export function EventFeed({ events }: Props) {
  if (events.length === 0) {
    return (
      <div className="min-h-[80px] grid place-content-center text-center text-muted text-sm border border-dashed border-accent/20 rounded-2xl">
        <p>Listening for orchestrator activity...</p>
      </div>
    )
  }

  // Filter out delivery signals — they're internal bookkeeping, not user-facing events
  const visibleEvents = events.filter((e) => e.type !== 'delivery_update')

  return (
    <div className="flex flex-col gap-3 overflow-y-auto min-h-0" role="log" aria-live="polite">
      {visibleEvents.slice(0, 10).map((event) => {
        const key = `${event.id}`
        const actorId = event.type === 'question' ? event.target : event.source
        const accent = colorForAgent(actorId)
        const sourceLabel = event.payload.meta?.sourceLabel ?? readableNodeLabel(event.source)
        const targetLabel = event.payload.meta?.targetLabel ?? readableNodeLabel(event.target)
        const status = statusIcon(event)

        return (
          <article key={key} className="flex items-start gap-3 py-2 border-b border-accent/10 last:border-b-0">
            {/* Status icon or colored dot */}
            {status.icon ? (
              <span
                className="w-4 h-4 flex items-center justify-center text-[10px] font-bold rounded-full mt-0.5 shrink-0"
                style={{ background: status.color, color: '#fff' }}
                title={status.label}
              >
                {status.icon}
              </span>
            ) : (
              <span className="w-2.5 h-2.5 rounded-full mt-1 shrink-0" style={{ background: accent }} aria-hidden />
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[0.65rem] capitalize font-medium px-1.5 py-0.5 rounded" style={{ background: colorForEventType(event.type), color: '#fff' }}>
                  {event.type.replace('_', ' ')}
                </span>
                <time className="text-xs text-muted ml-auto">{formatTime(Date.parse(event.timestamp))}</time>
              </div>
              <p className="text-sm text-foreground leading-relaxed line-clamp-2">{event.payload.summary}</p>
              <div className="flex items-center gap-2 text-xs text-muted mt-0.5">
                <span>{sourceLabel}</span>
                <span className="mx-1">&rarr;</span>
                <span>{targetLabel}</span>
                {/* Retry badge */}
                {event.payload.retry_count != null && event.payload.retry_count > 0 && (
                  <span className="text-[0.55rem] font-medium px-1 py-0.5 rounded bg-amber-500/20 text-amber-400">
                    retry {event.payload.retry_count}
                  </span>
                )}
                {/* Tool name for activity events */}
                {event.payload.current_tool && (
                  <span className="text-[0.55rem] font-mono px-1 py-0.5 rounded bg-blue-500/20 text-blue-400">
                    {event.payload.current_tool}
                  </span>
                )}
              </div>
            </div>
          </article>
        )
      })}
    </div>
  )
}
