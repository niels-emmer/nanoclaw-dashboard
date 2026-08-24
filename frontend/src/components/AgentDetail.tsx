import type { AgentSnapshot, TelemetryEvent } from '../lib/types'
import { colorForAgent, formatTime, readableNodeLabel } from '../lib/utils'
import { TOOL_CATEGORY_ICON } from '../lib/icons'

interface Props {
  agent: AgentSnapshot
  events: TelemetryEvent[]
  onClose: () => void
}

const stateCopy: Record<string, string> = {
  spinning_up: 'Spinning up',
  idle: 'Idle',
  running: 'In flight',
  error: 'Error',
  unknown: 'Unknown',
}

export function AgentDetail({ agent, events, onClose }: Props) {
  const accent = colorForAgent(agent.id)
  const recent = events
    .filter((e) => e.source.includes(agent.id) || e.target.includes(agent.id))
    .slice(0, 15)

  return (
    <div className="agent-detail-overlay" onClick={onClose}>
      <div className="agent-detail" onClick={(e) => e.stopPropagation()} style={{ borderTopColor: accent }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold" style={{ color: accent }}>{agent.label}</h2>
          <button onClick={onClose} className="text-muted hover:text-foreground text-sm">✕</button>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm mb-3">
          <div className="detail-cell">
            <span className="detail-label">State</span>
            <span className={agent.state === 'error' ? 'text-red-400' : ''}>{stateCopy[agent.state] ?? agent.state}</span>
          </div>
          <div className="detail-cell">
            <span className="detail-label">Model</span>
            <span>{agent.provider ?? '?'}/{agent.model ?? '?'}</span>
          </div>
          <div className="detail-cell">
            <span className="detail-label">Activity</span>
            <span>{agent.activityCount} messages</span>
          </div>
          <div className="detail-cell">
            <span className="detail-label">Errors</span>
            <span className={agent.errorCount > 0 ? 'text-red-400' : ''}>{agent.errorCount}</span>
          </div>
        </div>

        {agent.currentTool && (
          <div className="mb-3">
            <span className="detail-label block mb-1">Current tool</span>
            <div className="flex items-center gap-2 text-sm">
              {(() => {
                const Icon = TOOL_CATEGORY_ICON[agent.currentToolCategory] ?? null
                return Icon ? <Icon size={16} className="text-accent" /> : null
              })()}
              <span className="font-mono">{agent.currentTool}</span>
              {agent.toolElapsedMs != null && <span className="text-muted">{Math.round(agent.toolElapsedMs / 1000)}s</span>}
            </div>
          </div>
        )}

        {agent.skills.length > 0 && (
          <div className="mb-3">
            <span className="detail-label block mb-1">Skills</span>
            <div className="flex flex-wrap gap-1">
              {agent.skills.map((s) => (
                <span key={s} className="text-[0.65rem] px-1.5 py-0.5 rounded bg-accent/10 text-accent">{s}</span>
              ))}
            </div>
          </div>
        )}

        <div>
          <span className="detail-label block mb-1">Recent activity</span>
          {recent.length === 0 ? (
            <p className="text-sm text-muted">No recent events.</p>
          ) : (
            <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
              {recent.map((e) => (
                <div key={e.id} className="text-xs text-muted border-b border-accent/10 pb-1.5">
                  <div className="flex justify-between">
                    <span className="capitalize">{e.type.replace('_', ' ')}</span>
                    <time>{formatTime(Date.parse(e.timestamp))}</time>
                  </div>
                  <p className="text-foreground/80 line-clamp-2">{e.payload.summary}</p>
                  <span className="opacity-70">{readableNodeLabel(e.source)} &rarr; {readableNodeLabel(e.target)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
