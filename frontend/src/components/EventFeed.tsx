import type { TelemetryEvent } from '../lib/types'
import { agentLabelFromId, colorForAgent, formatTime } from '../lib/utils'

interface Props {
  events: TelemetryEvent[]
}

export function EventFeed({ events }: Props) {
  if (events.length === 0) {
    return (
      <div className="min-h-[80px] grid place-content-center text-center text-muted text-sm border border-dashed border-accent/20 rounded-2xl">
        <p>Listening for orchestrator activity...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1 overflow-y-auto min-h-0" role="log" aria-live="polite">
      {events.slice(0, 10).map((event) => {
        const key = `${event.id}`
        const actorId = event.type === 'question' ? event.target : event.source
        const accent = colorForAgent(actorId)
        const sourceLabel = event.payload.meta?.sourceLabel ?? readableNodeLabel(event.source)
        const targetLabel = event.payload.meta?.targetLabel ?? readableNodeLabel(event.target)
        return (
          <article key={key} className="grid grid-cols-[auto_1fr] gap-2 items-start py-1.5 border-b border-accent/10 last:border-b-0">
            <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: accent }} aria-hidden />
            <div>
              <div className="flex justify-between text-xs">
                <strong className="text-foreground capitalize">{event.type.replace('_', ' ')}</strong>
                <time className="text-muted">{formatTime(Date.parse(event.timestamp))}</time>
              </div>
              <p className="text-xs text-foreground mt-0.5 leading-relaxed">{event.payload.summary}</p>
              <div className="flex gap-1 text-[0.65rem] text-muted uppercase tracking-wide mt-0.5">
                <span>{sourceLabel}</span>
                <span>&rarr;</span>
                <span>{targetLabel}</span>
              </div>
            </div>
          </article>
        )
      })}
    </div>
  )
}

const readableNodeLabel = (id: string) => {
  if (id.startsWith('agent:')) return agentLabelFromId(id)
  if (id.startsWith('channel:')) {
    const channel = id.replace(/^channel:/, '')
    return `${channel} channel`
  }
  return id
}
