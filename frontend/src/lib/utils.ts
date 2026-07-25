import type { AgentState, AgentSnapshot, TelemetryEvent } from './types'

export const formatTime = (maybeMs: number) => {
  const safeMs = Number.isNaN(maybeMs) ? Date.now() : maybeMs
  const date = new Date(safeMs)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export const elapsedLabel = (maybeMs: number) => {
  const ms = Number.isNaN(maybeMs) ? Date.now() : maybeMs
  const delta = Date.now() - ms
  if (delta < 1000) return 'now'
  if (delta < 60_000) return `${Math.floor(delta / 1000)}s ago`
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`
  return `${Math.floor(delta / 3_600_000)}h ago`
}

export const agentLabelFromId = (id: string) => id.replace(/^agent:/, '')

const palette = ['#f97316', '#38bdf8', '#a855f7', '#22d3ee', '#ef4444', '#eab308']

export const colorForAgent = (id: string) => {
  let hash = 0
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash << 5) - hash + id.charCodeAt(i)
    hash |= 0
  }
  const idx = Math.abs(hash) % palette.length
  return palette[idx]
}

export const deriveAgentSnapshot = (
  prev: Record<string, AgentSnapshot>,
  event: TelemetryEvent,
): Record<string, AgentSnapshot> => {
  const snapshot = { ...prev }
  const id = normalizeAgentId(event)
  const label = agentLabelFromId(id)
  const state: AgentState | 'unknown' = event.agent_state ?? prev[id]?.state ?? 'unknown'
  snapshot[id] = {
    id,
    label,
    state,
    lastSummary: event.payload.summary,
    lastEventType: event.type,
    lastUpdated: Date.parse(event.timestamp) || Date.now(),
    activityCount: (prev[id]?.activityCount ?? 0) + 1,
  }
  return snapshot
}

export const normalizeAgentId = (event: TelemetryEvent) => {
  if (event.type === 'question') {
    return event.target.startsWith('agent:') ? event.target : event.source
  }
  return event.source.startsWith('agent:') ? event.source : event.target
}
