import { Card, Chip } from '@heroui/react'
import type { AgentSnapshot } from '../lib/types'
import { colorForAgent, ORCHESTRATOR_COLOR, readableNodeLabel, formatElapsed } from '../lib/utils'

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

  // Map display labels back to full agent IDs for consistent color lookup
  const labelToId = new Map<string, string>()
  for (const a of agents) {
    labelToId.set(a.label, a.id)
  }

  // Resolve color for any entity ID or label — handles the orchestrator's
  // hardcoded color so blobs match the FlowCanvas orbit node.
  const colorForEntity = (id: string) =>
    id === 'orchestrator' ? ORCHESTRATOR_COLOR : colorForAgent(id)

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
        const agentWasSource = agent.lastEventSource === agent.id
        const partnerId = agentWasSource ? agent.lastEventTarget : agent.lastEventSource
        const partnerLabel = partnerId ? readableNodeLabel(partnerId) : ''
        const partnerTone = partnerId ? colorForEntity(partnerId) : tone
        return (
          <Card key={agent.id} className="flex flex-col gap-1.5 p-3" style={{ borderColor: `${tone}40` }}>
            <Card.Header className="flex flex-row justify-between items-center p-0">
              <div className="flex items-baseline gap-2 min-w-0">
                {/* Liveness dot */}
                <span className={`inline-block w-2 h-2 rounded-full liveness-dot ${agent.liveness}`} />
                <Card.Title className="text-base capitalize truncate">{agent.label}</Card.Title>
                {/* Model/provider badge */}
                {agent.provider && (
                  <Chip size="sm" variant="soft" color="accent" className="text-[0.55rem] font-mono shrink-0">
                    {agent.provider}/{agent.model ?? 'default'}
                  </Chip>
                )}
                <Chip size="sm" variant="soft" color="accent" className="text-[0.65rem] shrink-0">
                  {stateCopy[agent.state] ?? agent.state}
                </Chip>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                {/* Pending approvals badge */}
                {agent.pendingApprovals > 0 && (
                  <Chip size="sm" variant="primary" color="danger" className="text-[0.55rem]">
                    {agent.pendingApprovals}
                  </Chip>
                )}
                <Chip size="sm" variant="secondary" color="accent" className="shrink-0">{agent.activityCount}</Chip>
              </div>
            </Card.Header>

            {/* Current activity line — replaces last-event line when agent is active */}
            {agent.currentTool ? (
              <div className="flex items-center gap-1 text-xs">
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full"
                  style={{ background: agent.currentToolCategory === 'executing' ? '#ef4444' :
                    agent.currentToolCategory === 'reading' ? '#38bdf8' :
                    agent.currentToolCategory === 'writing' ? '#f59e0b' :
                    agent.currentToolCategory === 'network' ? '#22d3ee' : '#a855f7' }}
                />
                <span className="text-foreground font-medium">{agent.currentTool}</span>
                <span className="text-muted">
                  ({formatElapsed(agent.toolElapsedMs)})
                </span>
                {agent.lastSummary && (
                  <span className="text-muted truncate">— {agent.lastSummary}</span>
                )}
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-1 text-xs">
                <span className="text-muted font-medium shrink-0 uppercase">{agent.lastEventType}:</span>
                <Chip size="sm" variant="soft" color="warning" className="text-[0.65rem]">
                  {agentWasSource ? '>' : '<'}
                </Chip>
                <span className="text-[0.65rem] font-medium px-1.5 py-0.5 rounded" style={{ background: partnerTone, color: '#fff' }}>
                  {partnerLabel}
                </span>
              </div>
            )}

            {agent.outboundTargets.length > 0 && (
              <div className="flex flex-wrap items-center gap-1 text-xs">
                <span className="text-muted font-medium shrink-0">TO:</span>
                {agent.outboundTargets.map((tgt) => {
                  const tgtId = labelToId.get(tgt)
                  const tgtTone = tgtId ? colorForEntity(tgtId) : colorForEntity(tgt)
                  return (
                    <span key={tgt} className="text-[0.65rem] font-medium px-1.5 py-0.5 rounded" style={{ background: tgtTone, color: '#fff' }}>
                      {tgt}
                    </span>
                  )
                })}
              </div>
            )}

            {agent.inboundSources.length > 0 && (
              <div className="flex flex-wrap items-center gap-1 text-xs">
                <span className="text-muted font-medium shrink-0">FR:</span>
                {agent.inboundSources.map((src) => {
                  const srcId = labelToId.get(src)
                  const srcTone = srcId ? colorForEntity(srcId) : colorForEntity(src)
                  return (
                    <span key={src} className="text-[0.65rem] font-medium px-1.5 py-0.5 rounded" style={{ background: srcTone, color: '#fff' }}>
                      {src}
                    </span>
                  )
                })}
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}
