import type { TelemetryEvent } from '../lib/types'
import { agentLabelFromId, colorForAgent, formatTime } from '../lib/utils'

interface Props {
  events: TelemetryEvent[]
}

export function EventFeed({ events }: Props) {
  if (events.length === 0) {
    return (
      <div className="event-feed empty">
        <p>Listening for orchestrator activity…</p>
      </div>
    )
  }

  return (
    <div className="event-feed" role="log" aria-live="polite">
      {events.slice(0, 8).map((event) => {
        const key = `${event.id}`
        const actorId = event.type === 'question' ? event.target : event.source
        const accent = colorForAgent(actorId)
        const sourceLabel = event.payload.meta?.sourceLabel ?? readableNodeLabel(event.source)
        const targetLabel = event.payload.meta?.targetLabel ?? readableNodeLabel(event.target)
        return (
          <article key={key} className={`event event-${event.type}`}>
            <span className="bullet" style={{ background: accent }} aria-hidden />
            <div className="event-body">
              <header>
                <strong>{event.type === 'question' ? 'Question' : event.type === 'response' ? 'Response' : 'Agent'}</strong>
                <time>{formatTime(Date.parse(event.timestamp))}</time>
              </header>
              <p>{event.payload.summary}</p>
              <footer>
                <span>{sourceLabel}</span>
                <span>→</span>
                <span>{targetLabel}</span>
              </footer>
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
