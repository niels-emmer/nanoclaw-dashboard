import { Chip } from '@heroui/react'
import type { AgentSnapshot } from '../lib/types'
import { colorForAgent } from '../lib/utils'

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
  const colorForEntity = (id: string) => colorForAgent(id)

  if (agents.length === 0) {
    return (
      <div className="min-h-[80px] grid place-content-center text-center text-muted text-sm border border-dashed border-accent/20 rounded-2xl">
        <p>No sub-agents yet — waiting for telemetry...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 overflow-y-auto flex-1 pr-1">
      {sorted.map((agent, idx) => {
        const isActive = agent.state === 'running' && agent.liveness === 'alive'

        return (
          <div key={agent.id} className={`flex flex-col gap-1.5 py-2 ${idx < sorted.length - 1 ? 'border-b border-accent/10' : ''}`}>
            {/* Single line: liveness dot + name (left) | model + status + errors + msgs (right) */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 liveness-dot ${agent.liveness} ${isActive ? 'liveness-pulse' : ''}`}
                />
                <span className="text-base capitalize truncate font-semibold">{agent.label}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {agent.provider ? (
                  <Chip size="sm" variant="soft" color="accent" className="text-[0.55rem] font-mono">
                    {agent.provider}/{agent.model ?? 'default'}
                  </Chip>
                ) : (
                  <span className="text-[0.55rem] text-muted font-mono">—/—</span>
                )}
                <Chip size="sm" variant="soft" color="accent" className="text-[0.6rem]">
                  {stateCopy[agent.state] ?? agent.state}
                </Chip>
                {agent.errorCount > 0 && (
                  <Chip size="sm" variant="primary" color="danger" className="text-[0.55rem]">
                    {agent.errorCount} err
                  </Chip>
                )}
                <Chip size="sm" variant="secondary" color="accent" className="shrink-0 text-[0.65rem]">
                  {agent.activityCount} msg
                </Chip>
                {agent.pendingApprovals > 0 && (
                  <Chip size="sm" variant="primary" color="warning" className="text-[0.55rem]">
                    {agent.pendingApprovals} pending
                  </Chip>
                )}
              </div>
            </div>

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
          </div>
        )
      })}
    </div>
  )
}
