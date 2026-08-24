import type { AgentSnapshot } from '../lib/types'
import type { ConnectionState } from '../hooks/useEventStream'

interface Props {
  orchestratorId: string
  connectionState: ConnectionState
  retryCount: number
  agents: AgentSnapshot[]
}

const connLabel: Record<ConnectionState, { text: string; cls: string }> = {
  connecting: { text: 'Connecting', cls: 'text-amber-400' },
  connected: { text: 'Live', cls: 'text-green-400' },
  reconnecting: { text: 'Reconnecting', cls: 'text-amber-400' },
  error: { text: 'Signal lost', cls: 'text-red-400' },
}

export function StatusStrip({ orchestratorId, connectionState, retryCount, agents }: Props) {
  const active = agents.filter((a) => a.state === 'running').length
  const errors = agents.filter((a) => a.state === 'error' || a.errorCount > 0).length
  const stuck = agents.filter((a) => a.state === 'running' && a.liveness === 'stale').length
  const pending = agents.reduce((sum, a) => sum + a.pendingApprovals, 0)
  const conn = connLabel[connectionState]

  return (
    <header className="status-strip">
      <div className="status-title">
        <span className="status-orchestrator">{orchestratorId}</span>
        <span className="status-sub">orchestrator</span>
      </div>

      <div className="status-metrics">
        <div className="status-metric">
          <span className="status-value text-green-400">{active}</span>
          <span className="status-label">active</span>
        </div>
        {errors > 0 && (
          <div className="status-metric">
            <span className="status-value text-red-400">{errors}</span>
            <span className="status-label">errors</span>
          </div>
        )}
        {stuck > 0 && (
          <div className="status-metric">
            <span className="status-value text-amber-400">{stuck}</span>
            <span className="status-label">stuck</span>
          </div>
        )}
        {pending > 0 && (
          <div className="status-metric">
            <span className="status-value text-purple-400">{pending}</span>
            <span className="status-label">pending</span>
          </div>
        )}
      </div>

      <div className="status-conn">
        <span className={`status-conn-dot ${conn.cls}`} />
        <span className={`status-conn-text ${conn.cls}`}>
          {conn.text}
          {retryCount > 0 && connectionState !== 'connected' ? ` (${retryCount})` : ''}
        </span>
      </div>
    </header>
  )
}
