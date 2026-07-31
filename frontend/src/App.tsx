import { useState } from 'react'
import { FlowCanvas } from './components/FlowCanvas'
import { AgentGrid } from './components/AgentGrid'
import { EventFeed } from './components/EventFeed'
import { ConnectionStatus } from './components/ConnectionStatus'
import { ErrorBoundary } from './components/ErrorBoundary'
import { useEventStream } from './hooks/useEventStream'
import { Chip, Typography } from '@heroui/react'
import './App.css'

function App() {
  const { agents, events, edges, bubbles, connectionState, retryCount, orchestratorId, topology } = useEventStream()
  const [filterAgentId, setFilterAgentId] = useState<string | null>(null)
  const [debugOpen, setDebugOpen] = useState(false)

  const runningCount = agents.filter((a) => a.state === 'running').length
  const idleCount = agents.filter((a) => a.state === 'idle').length
  const errorCount = agents.filter((a) => a.state === 'error').length
  const pendingApprovalCount = agents.reduce((sum, a) => sum + a.pendingApprovals, 0)

  const filteredEvents = filterAgentId
    ? events.filter((e) => e.source.includes(filterAgentId) || e.target.includes(filterAgentId))
    : events

  return (
    <div className="app-shell">
      <header className="masthead">
        <div className="masthead-copy">
          <Typography type="h1">NanoClaw Live Traffic</Typography>
        </div>
        <div className="masthead-status">
          <div className="flex items-center gap-3">
            <ConnectionStatus state={connectionState} retryCount={retryCount} />
            <dl className="status-callouts">
              <div>
                <dt>Agents</dt>
                <dd>{agents.length}</dd>
              </div>
              <div>
                <dt>Running</dt>
                <dd className="text-green-400">{runningCount}</dd>
              </div>
              <div>
                <dt>Idle</dt>
                <dd className="text-amber-400">{idleCount}</dd>
              </div>
              {errorCount > 0 && (
                <div>
                  <dt>Errors</dt>
                  <dd className="text-red-400">{errorCount}</dd>
                </div>
              )}
              {pendingApprovalCount > 0 && (
                <div>
                  <dt>Pending</dt>
                  <dd className="text-purple-400">{pendingApprovalCount}</dd>
                </div>
              )}
              <div>
                <dt>Workspace</dt>
                <dd>{orchestratorId}</dd>
              </div>
            </dl>
            <button
              onClick={() => setDebugOpen((v) => !v)}
              className={`text-xs px-2 py-1 rounded transition-colors font-mono ${
                debugOpen ? 'bg-accent/30 text-accent' : 'bg-accent/10 text-muted hover:bg-accent/20'
              }`}
              title="Toggle debug panel"
            >
              {debugOpen ? 'debug ●' : 'debug ○'}
            </button>
          </div>
        </div>
      </header>

      <main className="main-grid">
        <div className="canvas-panel rounded-[28px] border border-accent/10 bg-surface shadow-surface overflow-hidden">
          <div className="flex-1 flex flex-col min-h-0">
            <FlowCanvas
              orchestratorId={orchestratorId}
              agents={agents}
              edges={edges}
              bubbles={bubbles}
              topology={topology}
              onAgentClick={(agentId) => setFilterAgentId(agentId === filterAgentId ? null : agentId)}
              selectedAgentId={filterAgentId}
            />
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
              <span className="legend-item">
                <span className="legend-dot activity" />
                Activity
              </span>
              <span className="legend-item">
                <span className="legend-dot delivery" />
                Delivery
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
              <div className="flex items-center gap-2">
                {filterAgentId && (
                  <button
                    onClick={() => setFilterAgentId(null)}
                    className="text-[0.6rem] px-1.5 py-0.5 rounded bg-accent/20 text-accent hover:bg-accent/30 transition-colors"
                  >
                    ✕ {filterAgentId.replace('agent:', '')}
                  </button>
                )}
                <Chip color="accent" variant="soft" size="sm">
                  {events.length ? 'streaming' : 'idle'}
                </Chip>
              </div>
            </div>
            <div className="flex flex-col flex-1 min-h-0 overflow-y-auto px-4 pb-4">
              <EventFeed events={filteredEvents} />
            </div>
          </div>
        </aside>
      </main>

      {debugOpen && events.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 max-w-lg max-h-96 overflow-auto bg-surface/95 backdrop-blur border border-accent/20 rounded-xl p-4 shadow-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-foreground">Latest raw event</span>
            <button onClick={() => setDebugOpen(false)} className="text-xs text-muted hover:text-foreground">✕</button>
          </div>
          <pre className="text-[0.6rem] font-mono text-foreground/80 whitespace-pre-wrap break-all">
            {JSON.stringify(events[0], null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}

export default function AppWithErrorBoundary() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  )
}
