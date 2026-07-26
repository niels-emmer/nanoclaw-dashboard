import { FlowCanvas } from './components/FlowCanvas'
import { AgentGrid } from './components/AgentGrid'
import { EventFeed } from './components/EventFeed'
import { DebugPanel } from './components/DebugPanel'
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

  const frameworkInsights = [
    {
      title: 'Streaming-first feedback',
      body:
        'Edge pulses animate immediately so operators see the orchestrator "thinking" in motion, mirroring Fast.io guidance from Chainlit and Vercel AI SDK.',
    },
    {
      title: 'Transparent tool usage',
      body:
        'Agent cards and the event feed surface summaries, states, and routing details so every hop stays auditable, matching the observability pillar from the article.',
    },
    {
      title: 'Workspace-ready layout',
      body:
        'Modular panels keep the flow canvas, agent roster, and debug stream docked on a single 1080p surface, similar to Streamlit/Gradio dashboard recommendations.',
    },
  ]

  return (
    <div className="app-shell">
      <header className="masthead">
        <div className="masthead-copy">
          <p className="eyebrow">Live orchestrator · /ws/events</p>
          <h1>Nanoclaw Command Surface</h1>
          <p className="lede">
            Inspired by Fast.io&apos;s 2026 UI framework review, the dashboard leans into streaming feedback, transparent
            agent tooling, and multimodal readiness without leaving the single-screen orbit canvas.
          </p>
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
            <p className="status-label">Now streaming</p>
            <p className="status-summary">{lastEventSummary}</p>
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
            <p className="legend-note">
              Directional pulses mirror the Fast.io best-practice split between inbound questions, outbound responses, and
              runtime status updates.
            </p>
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

          <section className="panel insight-panel">
            <div className="panel-header">
              <h2>Interface tenets</h2>
              <span className="metric">Fast.io research</span>
            </div>
            <ul className="insight-list">
              {frameworkInsights.map((insight) => (
                <li key={insight.title}>
                  <strong>{insight.title}</strong>
                  <p>{insight.body}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="panel debug-wrapper">
            <DebugPanel event={events[0]} />
          </section>
        </aside>
      </main>
    </div>
  )
}

export default App
