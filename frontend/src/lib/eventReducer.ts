import type { AgentSnapshot, ChatBubble, EdgePulse, TelemetryEvent, TopologyData } from './types'
import { deriveAgentSnapshot, parseTopologyMeta, readableNodeLabel } from './utils'
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
  bubbles: ChatBubble[]
  orchestratorId: string
  topology: TopologyData | null
  humanAgentId: string | null
}

export type EventAction =
  | { type: 'event'; event: TelemetryEvent; now: number; maxEventHistory: number }
  | { type: 'expire_bubble'; id: string }

const EDGE_TTL_MS = 6500
const MAX_EDGES = 32
const MAX_BUBBLES = 3

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
    bubbles: [],
    orchestratorId,
    topology: null,
    humanAgentId: null,
  }
}

export function eventReducer(state: EventState, action: EventAction): EventState {
  switch (action.type) {
    case 'expire_bubble':
      return { ...state, bubbles: state.bubbles.filter((b) => b.id !== action.id) }

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

      // Spawn a chat bubble only for actual messages, not status updates
      let bubbles = state.bubbles
      if (event.type === 'question' || event.type === 'response') {
        const bubbleAgentId = event.type === 'question' ? event.target : event.source
        const sourceLabel = event.payload.meta?.sourceLabel ?? readableNodeLabel(event.source)
        const targetLabel = event.payload.meta?.targetLabel ?? readableNodeLabel(event.target)
        const summary = event.payload.summary
        const lines = summary
          .split(/(?<=[.?!])\s+|(?<=\n)/)
          .map((l) => l.trim())
          .filter(Boolean)
          .slice(0, 3)
        const bubble: ChatBubble = {
          id: event.id,
          agentId: bubbleAgentId,
          fromLabel: sourceLabel,
          toLabel: targetLabel,
          text: summary,
          lines: lines.length > 0 ? lines : [summary],
          type: event.type,
        }
        bubbles = [bubble, ...state.bubbles].slice(0, MAX_BUBBLES)
      }

      return { ...state, events, snapshots, edges, bubbles, orchestratorId, humanAgentId }
    }

    default:
      return state
  }
}
