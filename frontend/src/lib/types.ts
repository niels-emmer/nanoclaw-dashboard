export type EventType = 'question' | 'response' | 'agent_status' | 'activity_update' | 'delivery_update' | 'approval_pending' | 'topology_snapshot'
export type AgentState = 'spinning_up' | 'idle' | 'running' | 'error'
export type ToolCategory = 'thinking' | 'reading' | 'writing' | 'executing' | 'network' | 'waiting'
export type Liveness = 'alive' | 'stale' | 'dead' | 'unknown'

export interface TelemetryPayload {
  summary: string
  duration_ms?: number | null
  status: 'running' | 'completed' | 'error' | 'pending' | 'processing' | 'delivered' | 'failed'
  meta?: Record<string, string> | null

  // Activity / tool state
  current_tool?: string | null
  tool_elapsed_ms?: number | null
  tool_timeout_ms?: number | null

  // Agent capabilities
  provider?: string | null
  model?: string | null
  skills?: string[] | null

  // Liveness
  container_status?: string | null
  heartbeat_age_ms?: number | null

  // Processing / delivery
  retry_count?: number | null
  delivery_status?: string | null

  // Approvals
  approval_action?: string | null
  approval_title?: string | null
}

export interface TelemetryEvent {
  id: string
  timestamp: string
  type: EventType
  source: string
  target: string
  payload: TelemetryPayload
  agent_state?: AgentState | null
  schema_version?: string
}

export interface AgentSnapshot {
  id: string
  label: string
  state: AgentState | 'unknown'
  lastSummary: string
  lastEventType: EventType | null
  lastUpdated: number
  firstSeen: number
  activityCount: number
  lastEventSource: string | null
  lastEventTarget: string | null
  outboundTargets: string[]
  inboundSources: string[]
  skills: string[]

  // NEW: live ops fields
  currentTool: string | null
  currentToolCategory: ToolCategory
  toolElapsedMs: number | null
  toolTimeoutMs: number | null
  liveness: Liveness
  containerStatus: string | null
  heartbeatAgeMs: number | null
  provider: string | null
  model: string | null
  uptimeMs: number | null
  pendingApprovals: number
  errorCount: number
}

export interface EdgePulse {
  id: string
  source: string
  target: string
  type: EventType
  timestamp: number
}

export interface ChatBubble {
  id: string
  agentId: string
  fromLabel: string
  toLabel: string
  text: string
  lines: string[]
  type: EventType
}

export interface TopologyData {
  channels: Array<{ id: string; type: string; agents: string[] }>
  a2aEdges: Array<{ source: string; target: string }>
}
