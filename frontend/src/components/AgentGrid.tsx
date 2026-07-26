import { Card, Chip } from '@heroui/react'
import type { AgentSnapshot } from '../lib/types'
import { colorForAgent, elapsedLabel } from '../lib/utils'

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
      <div className="min-h-[80px] grid place-content-center text-center text-muted text-sm border border-dashed border-accent/20 rounded-2xl">
        <p>No sub-agents yet — waiting for telemetry...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 overflow-y-auto flex-1 pr-1">
      {agents.map((agent) => {
        const tone = colorForAgent(agent.id)
        return (
          <Card key={agent.id} className="flex flex-col gap-2 p-3" style={{ borderColor: `${tone}40` }}>
            <Card.Header className="flex flex-row justify-between items-center p-0">
              <div className="flex items-baseline gap-2 min-w-0">
                <Card.Title className="text-base capitalize truncate">{agent.label}</Card.Title>
                <Chip size="sm" variant="soft" color="accent" className="text-[0.65rem] shrink-0">
                  {stateCopy[agent.state] ?? agent.state}
                </Chip>
              </div>
              <Chip size="sm" variant="secondary" color="accent" className="shrink-0 ml-2">{agent.activityCount}</Chip>
            </Card.Header>
            <p className="text-sm text-foreground leading-relaxed line-clamp-2">{agent.lastSummary}</p>
            <div className="flex justify-between text-[0.75rem] text-muted">
              <span>{agent.lastEventType}</span>
              <span>{elapsedLabel(agent.lastUpdated)}</span>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
