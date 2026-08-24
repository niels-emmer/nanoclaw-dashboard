import { useMemo, useState } from 'react'
import { TreeGraph } from './components/tree/TreeGraph'
import { ActivityFeed } from './components/ActivityFeed'
import { ActivityDetail } from './components/ActivityDetail'
import { AgentRoster } from './components/AgentRoster'
import { AgentDetail } from './components/AgentDetail'
import { StatusStrip } from './components/StatusStrip'
import { ErrorBoundary } from './components/ErrorBoundary'
import { useEventStream } from './hooks/useEventStream'
import { buildActivityFeed } from './lib/activityFeed'
import './App.css'

function App() {
  const { agents, events, edges, connectionState, retryCount, orchestratorId, topology, humanAgentId, humanLastUpdated } = useEventStream()
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)

  const feed = useMemo(() => buildActivityFeed(events), [events])
  const selectedAgent = selectedAgentId ? agents.find((a) => a.id === selectedAgentId) : null
  const selectedEvent = selectedEventId ? feed.find((e) => e.id === selectedEventId) ?? null : null

  return (
    <div className="app-shell">
      <StatusStrip orchestratorId={orchestratorId} connectionState={connectionState} retryCount={retryCount} agents={agents} events={events} />

      <main className="main-grid">
        <div className="tree-panel">
          <TreeGraph
            orchestratorId={orchestratorId}
            agents={agents}
            edges={edges}
            topology={topology}
            humanAgentId={humanAgentId}
            humanLastUpdated={humanLastUpdated}
            onAgentClick={(id) => {
              setSelectedEventId(null)
              setSelectedAgentId(id === selectedAgentId ? null : id)
            }}
            selectedAgentId={selectedAgentId}
          />
        </div>

        <aside className="feed-panel">
          <div className="panel-header">
            <span className="panel-title">Live activity</span>
          </div>
          <ActivityFeed
            feed={feed}
            onSelect={(event) => {
              setSelectedAgentId(null)
              setSelectedEventId(event.id === selectedEventId ? null : event.id)
            }}
          />
        </aside>
      </main>

      <AgentRoster
        agents={agents}
        onSelect={(id) => {
          setSelectedEventId(null)
          setSelectedAgentId(id)
        }}
        selectedAgentId={selectedAgentId}
      />

      {selectedAgent && (
        <AgentDetail agent={selectedAgent} events={events} onClose={() => setSelectedAgentId(null)} />
      )}

      {selectedEvent && (
        <ActivityDetail event={selectedEvent} onClose={() => setSelectedEventId(null)} />
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
