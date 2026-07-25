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
        const actor = event.type === 'question' ? agentLabelFromId(event.target) : agentLabelFromId(event.source)
        const accent = colorForAgent(actor)
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
                <span>{event.source}</span>
                <span>→</span>
                <span>{event.target}</span>
              </footer>
            </div>
          </article>
        )
      })}
    </div>
  )
}
