import { FlowCanvas } from './components/FlowCanvas'
import { AgentGrid } from './components/AgentGrid'
import { EventFeed } from './components/EventFeed'
import { DebugPanel } from './components/DebugPanel'
import { ConnectionStatus } from './components/ConnectionStatus'
import { useEventStream } from './hooks/useEventStream'
import './App.css'

function App() {
  const { agents, events, edges, connectionState, orchestratorId } = useEventStream()

  return (
    <div className="app-shell">
      <header className="masthead">
        <div>
          <p className="eyebrow">Nanoclaw orchestrator</p>
          <h1>Delegation radar</h1>
          <p className="lede">Live flow of questions and responses as the orchestrator fans work out to its sub-agents.</p>
        </div>
        <ConnectionStatus state={connectionState} />
      </header>

      <main className="main-grid">
        <section className="panel canvas-panel">
          <FlowCanvas orchestratorId={orchestratorId} agents={agents} edges={edges} />
        </section>
        <section className="panel agents-panel">
          <div className="panel-header">
            <h2>Agents</h2>
            <span className="metric">{agents.length}</span>
          </div>
          <AgentGrid agents={agents} />
        </section>
      </main>

      <section className="panel events-panel">
        <div className="panel-header">
          <h2>Latest traffic</h2>
          <span className="metric">{events.length ? 'streaming' : 'idle'}</span>
        </div>
        <EventFeed events={events} />
      </section>

      <DebugPanel event={events[0]} />
    </div>
  )
}

export default App
