import { Chip } from '@heroui/react'
import type { ConnectionState } from '../hooks/useEventStream'

const config: Record<ConnectionState, { label: string; color: 'success' | 'warning' | 'danger' }> = {
  connecting: { label: 'Connecting', color: 'warning' },
  connected: { label: 'Live', color: 'success' },
  reconnecting: { label: 'Reconnecting', color: 'warning' },
  error: { label: 'Signal lost', color: 'danger' },
}

interface Props {
  state: ConnectionState
  retryCount?: number
}

export function ConnectionStatus({ state, retryCount = 0 }: Props) {
  const { label, color } = config[state]
  return (
    <Chip color={color} variant="primary" size="sm" data-state={state} title={retryCount > 0 ? `Reconnect attempts: ${retryCount}` : undefined}>
      {label}
      {retryCount > 0 && state !== 'connected' && (
        <span className="ml-1 text-[0.55rem] opacity-70">({retryCount})</span>
      )}
    </Chip>
  )
}
