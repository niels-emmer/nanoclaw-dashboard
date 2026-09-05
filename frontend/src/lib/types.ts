export type EventType = 'question' | 'response' | 'agent_status' | 'activity_update' | 'delivery_update' | 'approval_pending' | 'topology_snapshot' | 'instance_info' | 'config_snapshot'
export type AgentState = 'spinning_up' | 'idle' | 'running' | 'error'
export type ToolCategory = 'thinking' | 'reading' | 'writing' | 'executing' | 'network' | 'waiting'
export type Liveness = 'alive' | 'stale' | 'dead' | 'unknown'

export interface ToolUsage {
  name: string
  category: ToolCategory
  active: boolean
}

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
  tools: ToolUsage[]
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

export interface TopologyData {
  channels: Array<{ id: string; type: string; agents: string[] }>
  a2aEdges: Array<{ source: string; target: string }>
  tree?: { root: string; children: Record<string, string[]> }
}

// ---- Instance details (instance_info / config_snapshot events) ----

export interface InstanceHost {
  hostname?: string
  platform?: string
  pythonVersion?: string
  container?: string
}

export interface InstanceResources {
  cpuPercent?: number
  memoryUsedMb?: number
  memoryTotalMb?: number
  diskUsedMb?: number
  diskTotalMb?: number
}

export interface InstanceAgent {
  id: string
  label: string
  state: string
}

export interface InstanceMetrics {
  messagesTotal?: number
  errorsTotal?: number
  tokenBufferUsed?: number
  tokenBufferLimit?: number
  timeToResetMs?: number
  activeAgents?: number
}

export interface InstanceInfo {
  version?: string
  uptimeMs?: number
  host?: InstanceHost
  resources?: InstanceResources
  skills?: string[]
  models?: string[]
  agents?: InstanceAgent[]
  tools?: string[]
  metrics?: InstanceMetrics
  /** Local timestamp (ms) when this snapshot was received — for live ticking. */
  receivedAt?: number
}

export interface ConfigFile {
  id: string
  path: string
  name: string
  /** File content — not included in config_snapshot (metadata only); fetched on demand. */
  content?: string
}

export interface ConfigGroup {
  id: string
  label: string
  files: ConfigFile[]
}
