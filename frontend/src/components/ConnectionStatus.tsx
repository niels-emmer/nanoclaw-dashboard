import type { ConnectionState } from '../hooks/useEventStream'

const copy: Record<ConnectionState, { label: string; tone: string }> = {
  connecting: { label: 'Connecting', tone: 'amber' },
  connected: { label: 'Live', tone: 'emerald' },
  reconnecting: { label: 'Reconnecting', tone: 'amber' },
  error: { label: 'Signal lost', tone: 'rose' },
}

interface Props {
  state: ConnectionState
}

export function ConnectionStatus({ state }: Props) {
  const { label, tone } = copy[state]
  return (
    <div className={`connection-chip tone-${tone}`} data-state={state}>
      <span className="ping" aria-hidden />
      <span>{label}</span>
    </div>
  )
}
