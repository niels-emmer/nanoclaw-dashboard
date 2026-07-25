import { useState } from 'react'

import type { TelemetryEvent } from '../lib/types'

interface Props {
  event: TelemetryEvent | undefined
}

export function DebugPanel({ event }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`debug-panel ${open ? 'open' : ''}`}>
      <button type="button" onClick={() => setOpen((v) => !v)}>
        {open ? 'Hide' : 'Show'} debug
      </button>
      {open && (
        <pre>
          {event ? JSON.stringify(event, null, 2) : 'No events yet. Waiting for payloads...'}
        </pre>
      )}
    </div>
  )
}
