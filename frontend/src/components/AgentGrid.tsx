import { Card, Chip } from '@heroui/react'
import type { AgentSnapshot } from '../lib/types'
import { colorForAgent, elapsedLabel, readableNodeLabel } from '../lib/utils'

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
  const sorted = [...agents].sort((a, b) => b.activityCount - a.activityCount)

  if (agents.length === 0) {
    return (
      <div className="min-h-[80px] grid place-content-center text-center text-muted text-sm border border-dashed border-accent/20 rounded-2xl">
        <p>No sub-agents yet — waiting for telemetry...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 overflow-y-auto flex-1 pr-1">
      {sorted.map((agent) => {
        const tone = colorForAgent(agent.id)
        const sourceLabel = agent.lastEventSource ? readableNodeLabel(agent.lastEventSource) : null
        const targetLabel = agent.lastEventTarget ? readableNodeLabel(agent.lastEventTarget) : null
        return (
          <Card key={agent.id} className="flex flex-col gap-1.5 p-3" style={{ borderColor: `${tone}40` }}>
            <Card.Header className="flex flex-row justify-between items-center p-0">
              <div className="flex items-baseline gap-2 min-w-0">
                <Card.Title className="text-base capitalize truncate">{agent.label}</Card.Title>
                <Chip size="sm" variant="soft" color="accent" className="text-[0.65rem] shrink-0">
                  {stateCopy[agent.state] ?? agent.state}
                </Chip>
              </div>
              <Chip size="sm" variant="secondary" color="accent" className="shrink-0 ml-2">{agent.activityCount}</Chip>
            </Card.Header>

            <div className="text-xs text-muted leading-relaxed flex flex-wrap items-baseline gap-x-1">
              <span className="capitalize">{agent.lastEventType}</span>
              {sourceLabel && targetLabel && (
                <>
                  <span className="mx-0.5">&middot;</span>
                  <span>{sourceLabel}</span>
                  <span className="mx-0.5">&rarr;</span>
                  <span>{targetLabel}</span>
                </>
              )}
              <span className="mx-0.5">&middot;</span>
              <span>{elapsedLabel(agent.lastUpdated)}</span>
            </div>

            {agent.outboundTargets.length > 0 && (
              <div className="flex flex-wrap items-center gap-1 text-xs">
                <span className="text-muted font-medium shrink-0">TO:</span>
                {agent.outboundTargets.map((tgt) => (
                  <Chip key={tgt} size="sm" variant="soft" color="accent" className="text-[0.65rem]">
                    {tgt}
                  </Chip>
                ))}
              </div>
            )}

            {agent.inboundSources.length > 0 && (
              <div className="flex flex-wrap items-center gap-1 text-xs">
                <span className="text-muted font-medium shrink-0">FROM:</span>
                {agent.inboundSources.map((src) => (
                  <Chip key={src} size="sm" variant="soft" color="accent" className="text-[0.65rem]">
                    {src}
                  </Chip>
                ))}
              </div>
            )}

            {agent.skills.length > 0 && (
              <div className="flex flex-wrap items-center gap-1 text-xs">
                <span className="text-muted font-medium shrink-0">Skills:</span>
                {agent.skills.map((skill) => (
                  <Chip key={skill} size="sm" variant="secondary" color="accent" className="text-[0.6rem]">
                    {skill}
                  </Chip>
                ))}
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}
