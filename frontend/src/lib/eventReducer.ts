import type { AgentSnapshot, EdgePulse, TelemetryEvent, TopologyData } from './types'
import { deriveAgentSnapshot, parseTopologyMeta } from './utils'
import { channelName, isHumanChannel } from './channels'

/**
 * Pure event reducer — the single source of truth for dashboard state derived
 * from the telemetry stream. Kept free of side effects (time is passed in via
 * the action) so it is fully unit-testable.
 */

export interface EventState {
  events: TelemetryEvent[]
  snapshots: Record<string, AgentSnapshot>
  edges: EdgePulse[]
  orchestratorId: string
  topology: TopologyData | null
  humanAgentId: string | null
  humanLastUpdated: number | null
}

export type EventAction = { type: 'event'; event: TelemetryEvent; now: number; maxEventHistory: number }

const EDGE_TTL_MS = 6500
const MAX_EDGES = 32

/** Return the agent id if this event is a human-channel conversation, else null. */
function humanAgentFromEvent(event: TelemetryEvent): string | null {
  const srcChannel = channelName(event.source)
  const tgtChannel = channelName(event.target)
  if (srcChannel && isHumanChannel(event.source) && event.target.startsWith('agent:')) return event.target
  if (tgtChannel && isHumanChannel(event.target) && event.source.startsWith('agent:')) return event.source
  return null
}

export function createInitialState(orchestratorId: string): EventState {
  return {
    events: [],
    snapshots: {},
    edges: [],
    orchestratorId,
    topology: null,
    humanAgentId: null,
    humanLastUpdated: null,
  }
}

export function eventReducer(state: EventState, action: EventAction): EventState {
  switch (action.type) {
    case 'event': {
      const { event, now, maxEventHistory } = action

      // Track orchestrator id from topology metadata
      let orchestratorId = state.orchestratorId
      const orchestratorMeta = event.payload.meta?.orchestratorId
      if (orchestratorMeta && orchestratorMeta !== orchestratorId) {
        orchestratorId = orchestratorMeta
      }

      // Human-facing agent is sticky: set once from a real human-channel event,
      // never moved by agent-to-agent traffic.
      let humanAgentId = state.humanAgentId
      if (!humanAgentId) {
        const candidate = humanAgentFromEvent(event)
        if (candidate) humanAgentId = candidate
      }

      // Track the last time a real human-channel conversation occurred, so the
      // human node can fade out during inactivity like the other agents.
      let humanLastUpdated = state.humanLastUpdated
      if (humanAgentFromEvent(event)) humanLastUpdated = now

      // Topology snapshots are handled separately
      if (event.type === 'topology_snapshot') {
        const topo = parseTopologyMeta(event.payload.meta)
        return {
          ...state,
          orchestratorId,
          topology: topo ?? state.topology,
        }
      }

      // Store user-facing events in history (include activity_update for live-ops visibility)
      const events =
        event.type !== 'delivery_update'
          ? [event, ...state.events].slice(0, maxEventHistory)
          : state.events

      const snapshots = deriveAgentSnapshot(state.snapshots, event)

      // Edge pulses for question/response/activity events
      let edges = state.edges
      if (event.type === 'question' || event.type === 'response' || event.type === 'activity_update') {
        edges = [
          {
            id: event.id,
            source: event.source,
            target: event.target,
            type: event.type,
            timestamp: now,
          },
          ...state.edges.filter((edge) => now - edge.timestamp < EDGE_TTL_MS),
        ].slice(0, MAX_EDGES)
      }

      return { ...state, events, snapshots, edges, orchestratorId, humanAgentId, humanLastUpdated }
    }

    default:
      return state
  }
}
