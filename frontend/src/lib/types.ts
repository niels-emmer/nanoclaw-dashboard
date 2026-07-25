export type EventType = 'question' | 'response' | 'agent_status'
export type AgentState = 'spinning_up' | 'idle' | 'running' | 'error'

export interface TelemetryPayload {
  summary: string
  duration_ms?: number | null
  status: 'running' | 'completed' | 'error'
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
  activityCount: number
}

export interface EdgePulse {
  id: string
  source: string
  target: string
  type: EventType
  timestamp: number
}
