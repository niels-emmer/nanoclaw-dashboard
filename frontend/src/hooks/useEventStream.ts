import { useEffect, useMemo, useReducer, useRef, useState } from 'react'

import { config } from '../lib/config'
import type { TelemetryEvent } from '../lib/types'
import { createInitialState, eventReducer } from '../lib/eventReducer'

export type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'error'

const BUBBLE_TTL_MS = 5000

export const useEventStream = () => {
  const [state, dispatch] = useReducer(eventReducer, config.orchestratorId, createInitialState)
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting')
  const [retryCount, setRetryCount] = useState(0)
  const wsRef = useRef<WebSocket | null>(null)
  const retryRef = useRef<number | null>(null)

  useEffect(() => {
    let isCancelled = false

    const connect = () => {
      if (isCancelled) return
      setConnectionState((prev) => (prev === 'connected' ? 'reconnecting' : 'connecting'))
      try {
        const ws = new WebSocket(config.wsUrl)
        wsRef.current = ws

        ws.onopen = () => {
          setRetryCount(0)
          setConnectionState('connected')
        }
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
      setRetryCount((prev) => prev + 1)
      retryRef.current = window.setTimeout(connect, 1200)
      setConnectionState('reconnecting')
    }

    const handleEvent = (event: TelemetryEvent) => {
      dispatch({ type: 'event', event, now: Date.now(), maxEventHistory: config.maxEventHistory })

      // Schedule bubble expiry for actual messages (question/response)
      if (event.type === 'question' || event.type === 'response') {
        window.setTimeout(() => dispatch({ type: 'expire_bubble', id: event.id }), BUBBLE_TTL_MS)
      }
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
    return Object.values(state.snapshots).sort((a, b) => a.label.localeCompare(b.label))
  }, [state.snapshots])

  return {
    agents,
    events: state.events,
    edges: state.edges,
    bubbles: state.bubbles,
    connectionState,
    retryCount,
    orchestratorId: state.orchestratorId,
    topology: state.topology,
  }
}
