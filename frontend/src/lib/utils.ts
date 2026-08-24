import type { AgentSnapshot, Liveness, TelemetryEvent, ToolCategory, TopologyData } from './types'

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

export const formatElapsed = (ms: number | null | undefined): string => {
  if (ms == null) return ''
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s`
  const m = Math.floor(ms / 60_000)
  const s = Math.floor((ms % 60_000) / 1000)
  return `${m}m${s}s`
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

export const ORCHESTRATOR_COLOR = '#f59e0b'

const BRAND_COLORS: Record<string, string> = {
  orchestrator: ORCHESTRATOR_COLOR,
  // Platforms & Channels
  whatsapp: '#25D366', // Official WhatsApp green
  matrix: '#0DBD8B',   // Official Element / Matrix green
  element: '#0DBD8B',  // Official Element brand green
  slack: '#e01e5a',    // Slack brand magenta
  discord: '#5865f2',  // Discord brand blurple
  telegram: '#229ed9', // Telegram brand blue
  // Pinned Agent Colors
  researcher: '#38bdf8', // Sky blue
  coder: '#a855f7',      // Purple
  architect: '#f97316',  // Bright orange
  editor: '#22d3ee',     // Cyan
  terminal: '#ef4444',   // Red
  plotter: '#eab308',    // Yellow
  reviewer: '#ec4899',   // Pink
  marvin: '#8b5cf6',     // Violet / Indigo
}

const palette = ['#f97316', '#38bdf8', '#a855f7', '#22d3ee', '#ef4444', '#eab308', '#ec4899', '#8b5cf6', '#10b981']

const eventTypeColors: Record<string, string> = {
  question: '#a78bfa',
  response: '#7860d8',
  agent_status: '#c084fc',
  activity_update: '#38bdf8',
  delivery_update: '#22c55e',
  approval_pending: '#a855f7',
  topology_snapshot: '#6b7280',
}

export const colorForEventType = (type: string) => {
  return eventTypeColors[type] ?? '#6b7280'
}

export const colorForAgent = (id: string) => {
  if (!id) return palette[0]
  const cleanKey = id.toLowerCase().replace(/^agent:|^channel:/, '').trim()
  if (BRAND_COLORS[cleanKey]) {
    return BRAND_COLORS[cleanKey]
  }
  let hash = 0
  for (let i = 0; i < cleanKey.length; i += 1) {
    hash = (hash << 5) - hash + cleanKey.charCodeAt(i)
    hash |= 0
  }
  const idx = Math.abs(hash) % palette.length
  return palette[idx]
}

// Tool category mapping
const TOOL_CATEGORIES: Record<string, ToolCategory> = {
  Bash: 'executing',
  Read: 'reading',
  Write: 'writing',
  Edit: 'writing',
  Glob: 'reading',
  Grep: 'reading',
  WebSearch: 'network',
  WebFetch: 'network',
  Task: 'thinking',
  Skill: 'thinking',
}

export const toolCategory = (tool: string | null | undefined): ToolCategory => {
  if (!tool) return 'thinking'
  return TOOL_CATEGORIES[tool] ?? 'thinking'
}

export const toolCategoryColor = (category: ToolCategory): string => {
  switch (category) {
    case 'executing': return '#ef4444'
    case 'reading': return '#38bdf8'
    case 'writing': return '#f59e0b'
    case 'network': return '#22d3ee'
    case 'waiting': return '#a855f7'
    case 'thinking': return 'rgba(255,255,255,0.3)'
  }
}

// Liveness derivation
export const deriveLiveness = (
  containerStatus: string | null | undefined,
  heartbeatAgeMs: number | null | undefined,
): Liveness => {
  if (!containerStatus && heartbeatAgeMs == null) return 'unknown'
  if (containerStatus === 'stopped') return 'dead'
  if (containerStatus === 'idle') return 'stale'
  if (heartbeatAgeMs != null) {
    if (heartbeatAgeMs < 30_000) return 'alive'
    if (heartbeatAgeMs < 120_000) return 'stale'
    return 'dead'
  }
  if (containerStatus === 'running') return 'alive'
  return 'unknown'
}

// Agent opacity decay calculation
export const computeAgentOpacity = (
  lastUpdated: number,
  solidMinutes: number,
  fadeMinutes: number,
  now: number = Date.now(),
): number => {
  if (!fadeMinutes || fadeMinutes <= 0) return 1.0
  const ageMs = now - lastUpdated
  const solidMs = solidMinutes * 60_000
  const fadeMs = fadeMinutes * 60_000
  if (ageMs <= solidMs) return 1.0
  if (ageMs >= solidMs + fadeMs) return 0.0
  return Math.max(0, 1.0 - (ageMs - solidMs) / fadeMs)
}

// Topology parsing
export const parseTopologyMeta = (meta: Record<string, string> | null | undefined): TopologyData | null => {
  if (!meta) return null
  try {
    const channels = meta.channels ? JSON.parse(meta.channels) : []
    const a2aEdges = meta.a2aEdges ? JSON.parse(meta.a2aEdges) : []
    const tree = meta.tree ? JSON.parse(meta.tree) : undefined
    return { channels, a2aEdges, tree }
  } catch {
    return null
  }
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
    const ts = Date.now()

    const rawCandidate = (() => {
      if (event.source === id) return event.payload.meta?.sourceLabel
      if (event.target === id) return event.payload.meta?.targetLabel
      return undefined
    })()

    const isRawId = (lbl: string | undefined) => !lbl || /^ag-/i.test(lbl)

    const label = (() => {
      if (rawCandidate && !isRawId(rawCandidate)) return rawCandidate
      if (prevSnapshot?.label && !isRawId(prevSnapshot.label)) return prevSnapshot.label
      return rawCandidate ?? prevSnapshot?.label ?? agentLabelFromId(id)
    })()

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

    // New fields from payload
    const p = event.payload
    // Clear currentTool when a processing_ack signals completion without a new tool
    const currentTool = (p.current_tool != null)
      ? p.current_tool
      : (event.type === 'activity_update' && p.status === 'completed')
        ? null
        : (prevSnapshot?.currentTool ?? null)
    const currentToolCategory = toolCategory(currentTool)

    // Maintain a recent tool history: the active tool first, previously-used
    // tools ghosted to the right. Capped to keep the node uncluttered.
    let tools = prevSnapshot ? [...prevSnapshot.tools] : []
    if (p.current_tool != null) {
      tools = [
        { name: p.current_tool, category: toolCategory(p.current_tool), active: true },
        ...tools.filter((t) => t.name !== p.current_tool),
      ]
      tools = tools.map((t, i) => (i === 0 ? t : { ...t, active: false }))
    } else if (event.type === 'activity_update' && p.status === 'completed') {
      tools = tools.map((t) => ({ ...t, active: false }))
    }
    tools = tools.slice(0, 4)
    const toolElapsedMs = p.tool_elapsed_ms ?? prevSnapshot?.toolElapsedMs ?? null
    const toolTimeoutMs = p.tool_timeout_ms ?? prevSnapshot?.toolTimeoutMs ?? null
    const containerStatus = p.container_status ?? prevSnapshot?.containerStatus ?? null
    const heartbeatAgeMs = p.heartbeat_age_ms ?? prevSnapshot?.heartbeatAgeMs ?? null
    // Provider/model belong to the primary agent (the one the event is about).
    // Don't let a secondary agent's config leak onto other agents.
    const provider = isPrimary ? (p.provider ?? prevSnapshot?.provider ?? null) : (prevSnapshot?.provider ?? null)
    const model = isPrimary ? (p.model ?? prevSnapshot?.model ?? null) : (prevSnapshot?.model ?? null)
    const liveness = deriveLiveness(containerStatus, heartbeatAgeMs)

    // Track pending approvals
    let pendingApprovals = prevSnapshot?.pendingApprovals ?? 0
    if (event.type === 'approval_pending' && (event.source === id || event.target === id)) {
      pendingApprovals += 1
    }

    // Track error count
    let errorCount = prevSnapshot?.errorCount ?? 0
    if (isPrimary && (event.agent_state === 'error' || event.payload.status === 'error')) {
      errorCount += 1
    }

    // Only question/response events should transition running↔idle.
    // activity_update processing_acks set agent_state=IDLE prematurely
    // (the agent hasn't responded yet), which kills the pulsing ring.
    const nextState = (() => {
      if (!isPrimary) return prevSnapshot?.state ?? 'unknown'
      if (event.type === 'question') return event.agent_state ?? prevSnapshot?.state ?? 'unknown'
      if (event.type === 'response') return event.agent_state ?? prevSnapshot?.state ?? 'unknown'
      // For all other event types, preserve the current state
      return prevSnapshot?.state ?? 'unknown'
    })()

    snapshot[id] = {
      id,
      label,
      state: nextState,
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
      // New fields
      currentTool,
      currentToolCategory,
      toolElapsedMs,
      toolTimeoutMs,
      tools,
      liveness,
      containerStatus,
      heartbeatAgeMs,
      provider,
      model,
      uptimeMs: heartbeatAgeMs ?? prevSnapshot?.uptimeMs ?? null,
      pendingApprovals,
      errorCount,
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
