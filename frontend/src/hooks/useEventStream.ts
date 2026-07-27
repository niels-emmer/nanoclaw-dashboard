import { useEffect, useMemo, useRef, useState } from 'react'

import { config } from '../lib/config'
import type { AgentSnapshot, ChatBubble, EdgePulse, TelemetryEvent, TopologyData } from '../lib/types'
import { deriveAgentSnapshot, parseTopologyMeta, readableNodeLabel } from '../lib/utils'

export type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'error'

const EDGE_TTL_MS = 6500

export const useEventStream = () => {
  const [events, setEvents] = useState<TelemetryEvent[]>([])
  const [snapshots, setSnapshots] = useState<Record<string, AgentSnapshot>>({})
  const [edges, setEdges] = useState<EdgePulse[]>([])
  const [bubbles, setBubbles] = useState<ChatBubble[]>([])
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting')
  const [orchestratorId, setOrchestratorId] = useState(config.orchestratorId)
  const [topology, setTopology] = useState<TopologyData | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const retryRef = useRef<number | null>(null)
  const orchestratorRef = useRef(config.orchestratorId)

  useEffect(() => {
    let isCancelled = false

    const connect = () => {
      if (isCancelled) return
      setConnectionState((prev) => (prev === 'connected' ? 'reconnecting' : 'connecting'))
      try {
        const ws = new WebSocket(config.wsUrl)
        wsRef.current = ws

        ws.onopen = () => setConnectionState('connected')
        ws.onerror = () => setConnectionState('error')
        ws.onclose = () => {
          if (!isCancelled) scheduleReconnect()
        }

        ws.onmessage = (evt) => {
          try {
            const parsed = JSON.parse(evt.data) as TelemetryEvent
            handleEvent(parsed)
          } catch (error) {
            console.error('Failed to parse event', error)
          }
        }
      } catch (error) {
        console.error('WebSocket init error', error)
        scheduleReconnect()
      }
    }

    const scheduleReconnect = () => {
      if (isCancelled) return
      if (retryRef.current) {
        window.clearTimeout(retryRef.current)
      }
      retryRef.current = window.setTimeout(connect, 1200)
      setConnectionState('reconnecting')
    }

    const handleEvent = (event: TelemetryEvent) => {
      const orchestratorMeta = event.payload.meta?.orchestratorId
      if (orchestratorMeta && orchestratorMeta !== orchestratorRef.current) {
        orchestratorRef.current = orchestratorMeta
        setOrchestratorId(orchestratorMeta)
      }

      // Handle topology snapshots separately
      if (event.type === 'topology_snapshot') {
        const topo = parseTopologyMeta(event.payload.meta)
        if (topo) setTopology(topo)
        return
      }

      // Store event in history (skip topology_snapshot)
      setEvents((prev) => [event, ...prev].slice(0, config.maxEventHistory))
      setSnapshots((prev) => deriveAgentSnapshot(prev, event))

      // Edge pulses for question/response/activity events
      if (event.type === 'question' || event.type === 'response' || event.type === 'activity_update') {
        setEdges((prev) => {
          const now = Date.now()
          const next = [
            {
              id: event.id,
              source: event.source,
              target: event.target,
              type: event.type,
              timestamp: now,
            },
            ...prev.filter((edge) => now - edge.timestamp < EDGE_TTL_MS),
          ]
          return next.slice(0, 32)
        })
      }

      // Spawn a chat bubble anchored to the relevant agent
      const bubbleAgentId =
        event.type === 'question' ? event.target : event.source
      const sourceLabel = event.payload.meta?.sourceLabel ?? readableNodeLabel(event.source)
      const targetLabel = event.payload.meta?.targetLabel ?? readableNodeLabel(event.target)
      const summary = event.payload.summary
      // Split summary into lines for display
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
      setBubbles((prev) => [bubble, ...prev].slice(0, 6))
      setTimeout(() => {
        setBubbles((prev) => prev.filter((b) => b.id !== event.id))
      }, 5000)
    }

    connect()

    return () => {
      isCancelled = true
      if (retryRef.current) {
        window.clearTimeout(retryRef.current)
      }
      wsRef.current?.close()
    }
  }, [])

  const agents = useMemo(() => {
    return Object.values(snapshots).sort((a, b) => a.label.localeCompare(b.label))
  }, [snapshots])

  return { agents, events, edges, bubbles, connectionState, orchestratorId, topology }
}
