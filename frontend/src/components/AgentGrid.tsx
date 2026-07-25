import type { AgentSnapshot } from '../lib/types'
import { agentLabelFromId, colorForAgent, elapsedLabel } from '../lib/utils'

interface Props {
  agents: AgentSnapshot[]
}

const stateCopy: Record<string, string> = {
  spinning_up: 'Spinning up',
  idle: 'Idle',
  running: 'In flight',
  error: 'Error',
  unknown: 'Unknown',
}

export function AgentGrid({ agents }: Props) {
  if (agents.length === 0) {
    return (
      <div className="empty-card">
        <p>No sub-agents yet — waiting for telemetry...</p>
      </div>
    )
  }

  return (
    <div className="agent-grid">
      {agents.map((agent) => {
        const tone = colorForAgent(agent.id)
        return (
          <article className="agent-card" key={agent.id} style={{ borderColor: tone }}>
            <header>
              <div>
                <p className="agent-label">{agentLabelFromId(agent.id)}</p>
                <small>{stateCopy[agent.state] ?? agent.state}</small>
              </div>
              <span className="agent-count">{agent.activityCount}</span>
            </header>
            <p className="agent-summary">{agent.lastSummary}</p>
            <footer>
              <span>{agent.lastEventType}</span>
              <span>{elapsedLabel(agent.lastUpdated)}</span>
            </footer>
          </article>
        )
      })}
    </div>
  )
}
