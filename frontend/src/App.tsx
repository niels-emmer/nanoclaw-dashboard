import { FlowCanvas } from './components/FlowCanvas'
import { AgentGrid } from './components/AgentGrid'
import { EventFeed } from './components/EventFeed'
import { ConnectionStatus } from './components/ConnectionStatus'
import { useEventStream } from './hooks/useEventStream'
import { formatTime } from './lib/utils'
import './App.css'

function App() {
  const { agents, events, edges, connectionState, orchestratorId } = useEventStream()
  const lastEvent = events[0]
  const lastEventSummary = lastEvent?.payload.summary ?? 'Standing by for telemetry'
  const lastEventTimestamp = lastEvent ? formatTime(Date.parse(lastEvent.timestamp)) : '--'

  const capabilityHighlights = [
    {
      label: 'Real-time streaming',
      detail: connectionState === 'connected' ? 'WebSocket lock-on' : 'Negotiating signal',
    },
    { label: 'Step-level observability', detail: `${events.length} tracked events` },
    { label: 'Multimodal ready', detail: 'Meta payload surfaces attachments' },
  ]

  return (
    <div className="app-shell">
      <header className="masthead">
        <div className="masthead-copy">
          <h1>Nanoclaw Command Surface</h1>
          <ul className="framework-pill-list">
            {capabilityHighlights.map((highlight) => (
              <li key={highlight.label} className="framework-pill">
                <span>{highlight.label}</span>
                <small>{highlight.detail}</small>
              </li>
            ))}
          </ul>
        </div>
        <div className="masthead-status">
          <ConnectionStatus state={connectionState} />
          <dl className="status-callouts">
            <div>
              <dt>Active agents</dt>
              <dd>{agents.length}</dd>
            </div>
            <div>
              <dt>Live pulses</dt>
              <dd>{edges.length}</dd>
            </div>
            <div>
              <dt>Last signal</dt>
              <dd>{lastEventTimestamp}</dd>
            </div>
            <div>
              <dt>Workspace</dt>
              <dd>{orchestratorId}</dd>
            </div>
          </dl>
          <div className="status-stream">
            <span className="status-label">Now streaming</span>
            <span className="status-summary">{lastEventSummary}</span>
          </div>
        </div>
      </header>

      <main className="main-grid">
        <section className="panel canvas-panel">
          <FlowCanvas orchestratorId={orchestratorId} agents={agents} edges={edges} />
          <div className="signal-legend" aria-hidden>
            <div className="legend-items">
              <span className="legend-item">
                <span className="legend-dot question" />
                Questions
              </span>
              <span className="legend-item">
                <span className="legend-dot response" />
                Responses
              </span>
              <span className="legend-item">
                <span className="legend-dot status" />
                Agent status
              </span>
            </div>
          </div>
        </section>

        <aside className="detail-stack">
          <section className="panel agents-panel">
            <div className="panel-header">
              <h2>Agents</h2>
              <span className="metric">{agents.length}</span>
            </div>
            <AgentGrid agents={agents} />
          </section>

          <section className="panel events-panel">
            <div className="panel-header">
              <h2>Latest traffic</h2>
              <span className="metric">{events.length ? 'streaming' : 'idle'}</span>
            </div>
            <EventFeed events={events} />
          </section>
        </aside>
      </main>
    </div>
  )
}

export default App
