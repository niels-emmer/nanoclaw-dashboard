import { Chip } from '@heroui/react'
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
    <div className="flex flex-col gap-3 overflow-y-auto min-h-0" role="log" aria-live="polite">
      {events.slice(0, 10).map((event) => {
        const key = `${event.id}`
        const actorId = event.type === 'question' ? event.target : event.source
        const accent = colorForAgent(actorId)
        const sourceLabel = event.payload.meta?.sourceLabel ?? readableNodeLabel(event.source)
        const targetLabel = event.payload.meta?.targetLabel ?? readableNodeLabel(event.target)
        return (
          <article key={key} className="flex items-start gap-3 py-2 border-b border-accent/10 last:border-b-0">
            <span className="w-2.5 h-2.5 rounded-full mt-1 shrink-0" style={{ background: accent }} aria-hidden />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <Chip size="sm" variant="soft" color="accent" className="text-[0.65rem] capitalize">
                  {event.type.replace('_', ' ')}
                </Chip>
                <time className="text-xs text-muted ml-auto">{formatTime(Date.parse(event.timestamp))}</time>
              </div>
              <p className="text-sm text-foreground leading-relaxed line-clamp-2">{event.payload.summary}</p>
              <div className="text-xs text-muted mt-0.5">
                <span>{sourceLabel}</span>
                <span className="mx-1">&rarr;</span>
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
