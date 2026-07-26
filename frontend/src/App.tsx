import { FlowCanvas } from './components/FlowCanvas'
import { AgentGrid } from './components/AgentGrid'
import { EventFeed } from './components/EventFeed'
import { ConnectionStatus } from './components/ConnectionStatus'
import { useEventStream } from './hooks/useEventStream'
import { formatTime } from './lib/utils'
import { Chip, Typography } from '@heroui/react'
import './App.css'

function App() {
  const { agents, events, edges, bubbles, connectionState, orchestratorId } = useEventStream()
  const lastEvent = events[0]
  const lastEventTimestamp = lastEvent ? formatTime(Date.parse(lastEvent.timestamp)) : '--'

  return (
    <div className="app-shell">
      <header className="masthead">
        <div className="masthead-copy">
          <Typography type="h1">NanoClaw Live Traffic</Typography>
        </div>
        <div className="masthead-status">
          <div className="flex items-center gap-3">
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
          </div>
        </div>
      </header>

      <main className="main-grid">
        <div className="canvas-panel rounded-[28px] border border-accent/10 bg-surface shadow-surface overflow-hidden">
          <div className="flex-1 flex flex-col min-h-0">
            <FlowCanvas orchestratorId={orchestratorId} agents={agents} edges={edges} bubbles={bubbles} />
          </div>
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
        </div>

        <aside className="detail-stack">
          <div className="flex flex-col min-h-0 h-full rounded-[20px] border border-accent/10 bg-surface shadow-surface overflow-hidden">
            <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
              <span className="text-sm font-semibold text-foreground">Agents</span>
              <Chip color="accent" variant="soft" size="sm">{agents.length}</Chip>
            </div>
            <div className="flex flex-col flex-1 min-h-0 overflow-y-auto px-4 pb-4">
              <AgentGrid agents={agents} />
            </div>
          </div>

          <div className="flex flex-col min-h-0 h-full rounded-[20px] border border-accent/10 bg-surface shadow-surface overflow-hidden">
            <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
              <span className="text-sm font-semibold text-foreground">Latest traffic</span>
              <Chip color="accent" variant="soft" size="sm">
                {events.length ? 'streaming' : 'idle'}
              </Chip>
            </div>
            <div className="flex flex-col flex-1 min-h-0 overflow-y-auto px-4 pb-4">
              <EventFeed events={events} />
            </div>
          </div>
        </aside>
      </main>
    </div>
  )
}

export default App
