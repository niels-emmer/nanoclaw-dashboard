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
}

export function ConnectionStatus({ state }: Props) {
  const { label, color } = config[state]
  return (
    <Chip color={color} variant="primary" size="sm" data-state={state}>
      {label}
    </Chip>
  )
}
