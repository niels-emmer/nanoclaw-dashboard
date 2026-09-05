import { useEffect, useState } from 'react'
import type { AgentSnapshot, TelemetryEvent } from '../lib/types'
import type { ConnectionState } from '../hooks/useEventStream'

interface Props {
  orchestratorId: string
  connectionState: ConnectionState
  retryCount: number
  agents: AgentSnapshot[]
  events: TelemetryEvent[]
  onOpenDetails?: () => void
}

const connLabel: Record<ConnectionState, { text: string; cls: string }> = {
  connecting: { text: 'Connecting', cls: 'text-amber-400' },
  connected: { text: 'Live', cls: 'text-green-400' },
  reconnecting: { text: 'Reconnecting', cls: 'text-amber-400' },
  error: { text: 'Signal lost', cls: 'text-red-400' },
}

const RATE_WINDOW_MS = 60_000

function formatAgo(ms: number): string {
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  return `${Math.floor(m / 60)}h ago`
}

export function StatusStrip({ orchestratorId, connectionState, retryCount, agents, events, onOpenDetails }: Props) {
  const [now, setNow] = useState(() => Date.now())

  // Tick every second so the clock and "last activity" stay fresh.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const active = agents.filter((a) => a.state === 'running').length
  const total = agents.length
  const errors = agents.filter((a) => a.state === 'error' || a.errorCount > 0).length
  const stuck = agents.filter((a) => a.state === 'running' && a.liveness === 'stale').length
  const pending = agents.reduce((sum, a) => sum + a.pendingApprovals, 0)
  const conn = connLabel[connectionState]

  const orchestratorLabel = agents.find((a) => a.id === orchestratorId)?.label ?? orchestratorId

  const newest = events[0]
  const lastActivity = newest ? formatAgo(Math.max(0, now - new Date(newest.timestamp).getTime())) : '—'
  const messageRate = events.filter((e) => now - new Date(e.timestamp).getTime() < RATE_WINDOW_MS).length
  const clock = new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })

  return (
    <header className="status-strip">
      <div className="status-title">
        <span className="status-orchestrator">NanoClaw Live Dashboard</span>
        <span className="status-sub">orchestrator · {orchestratorLabel}</span>
      </div>

      <div className="status-metrics">
        <div className="status-metric">
          <span className="status-value text-green-400">{active}/{total}</span>
          <span className="status-label">active</span>
        </div>
        <div className="status-metric">
          <span className="status-value">{lastActivity}</span>
          <span className="status-label">last activity</span>
        </div>
        <div className="status-metric">
          <span className="status-value">{messageRate}</span>
          <span className="status-label">msg/min</span>
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

      <div className="status-right">
        <span className="status-clock">{clock}</span>
        <button
          type="button"
          className="status-conn"
          onClick={onOpenDetails}
          title="Nanoclaw instance details"
          aria-label="Open nanoclaw instance details"
        >
          <span className={`status-conn-dot ${conn.cls}`} />
          <span className={`status-conn-text ${conn.cls}`}>
            {conn.text}
            {retryCount > 0 && connectionState !== 'connected' ? ` (${retryCount})` : ''}
          </span>
        </button>
      </div>
    </header>
  )
}
