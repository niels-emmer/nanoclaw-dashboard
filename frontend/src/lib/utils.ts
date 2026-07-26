import type { AgentSnapshot, TelemetryEvent } from './types'

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

export const compactAge = (maybeMs: number) => {
  const ms = Number.isNaN(maybeMs) ? Date.now() : maybeMs
  const delta = Date.now() - ms
  if (delta < 1000) return 'now'
  if (delta < 60_000) return `${Math.floor(delta / 1000)}s`
  if (delta < 3_600_000) {
    const m = Math.floor(delta / 60_000)
    const s = Math.floor((delta % 60_000) / 1000)
    return `${m}m${s}s`
  }
  if (delta < 86_400_000) {
    const h = Math.floor(delta / 3_600_000)
    const m = Math.floor((delta % 3_600_000) / 60_000)
    return `${h}h${m}m`
  }
  return `${Math.floor(delta / 86_400_000)}d`
}

export const agentLabelFromId = (id: string) => id.replace(/^agent:/, '')

export const readableNodeLabel = (id: string) => {
  if (id.startsWith('agent:')) return agentLabelFromId(id)
  if (id.startsWith('channel:')) {
    const channel = id.replace(/^channel:/, '')
    return `${channel} channel`
  }
  return id
}

const palette = ['#f97316', '#38bdf8', '#a855f7', '#22d3ee', '#ef4444', '#eab308']

const eventTypeColors: Record<string, string> = {
  question: '#a78bfa',
  response: '#7860d8',
  agent_status: '#c084fc',
}

export const colorForEventType = (type: string) => {
  return eventTypeColors[type] ?? '#6b7280'
}

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

  const agentIds: string[] = []
  if (event.source.startsWith('agent:')) agentIds.push(event.source)
  if (event.target.startsWith('agent:') && !agentIds.includes(event.target)) agentIds.push(event.target)

  const primaryId = normalizeAgentId(event)

  for (const id of agentIds) {
    const isPrimary = id === primaryId
    const prevSnapshot = prev[id]
    const ts = Date.parse(event.timestamp) || Date.now()

    const label = (() => {
      if (event.source === id) return event.payload.meta?.sourceLabel
      if (event.target === id) return event.payload.meta?.targetLabel
      return undefined
    })() ?? prevSnapshot?.label ?? agentLabelFromId(id)

    const outboundTargets = prevSnapshot ? [...prevSnapshot.outboundTargets] : []
    const inboundSources = prevSnapshot ? [...prevSnapshot.inboundSources] : []

    if (event.source === id && event.target !== id) {
      const lbl = event.payload.meta?.targetLabel ?? agentLabelFromId(event.target)
      if (!outboundTargets.includes(lbl)) outboundTargets.push(lbl)
    }
    if (event.target === id && event.source !== id) {
      const lbl = event.payload.meta?.sourceLabel ?? agentLabelFromId(event.source)
      if (!inboundSources.includes(lbl)) inboundSources.push(lbl)
    }

    const skillsRaw = event.payload.meta?.skills
    const skills = skillsRaw ? skillsRaw.split(',').filter(Boolean) : (prevSnapshot?.skills ?? [])

    snapshot[id] = {
      id,
      label,
      state: isPrimary ? (event.agent_state ?? prevSnapshot?.state ?? 'unknown') : (prevSnapshot?.state ?? 'unknown'),
      lastSummary: isPrimary ? event.payload.summary : (prevSnapshot?.lastSummary ?? ''),
      lastEventType: isPrimary ? event.type : (prevSnapshot?.lastEventType ?? null),
      lastUpdated: isPrimary ? ts : (prevSnapshot?.lastUpdated ?? ts),
      firstSeen: prevSnapshot?.firstSeen ?? ts,
      activityCount: (prevSnapshot?.activityCount ?? 0) + (isPrimary ? 1 : 0),
      lastEventSource: event.source,
      lastEventTarget: event.target,
      outboundTargets,
      inboundSources,
      skills,
    }
  }

  return snapshot
}

export const normalizeAgentId = (event: TelemetryEvent) => {
  if (event.type === 'question') {
    return event.target.startsWith('agent:') ? event.target : event.source
  }
  return event.source.startsWith('agent:') ? event.source : event.target
}
