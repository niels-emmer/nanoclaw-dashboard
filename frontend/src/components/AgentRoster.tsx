import { useEffect, useState } from 'react'
import type { AgentSnapshot } from '../lib/types'
import { colorForAgent } from '../lib/utils'
import { ICON_MAP, TOOL_CATEGORY_ICON } from '../lib/icons'

interface Props {
  agents: AgentSnapshot[]
  onSelect?: (agentId: string) => void
  selectedAgentId?: string | null
}

const IDLE_HIDE_MS = 30_000

export function AgentRoster({ agents, onSelect, selectedAgentId }: Props) {
  const [now, setNow] = useState(0)

  // Tick every second so the roster auto-hides after an idle timeout.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const anyActive = agents.some((a) => a.state === 'running')
  const lastActivity = agents.reduce((max, a) => Math.max(max, a.lastUpdated), 0)

  // Auto-hide when nothing has been active for a while.
  const hidden = !anyActive && now > 0 && now - lastActivity > IDLE_HIDE_MS

  if (hidden) {
    return (
      <div className="roster-strip roster-hidden" aria-hidden>
        <span className="text-xs text-muted">agents idle</span>
      </div>
    )
  }

  const sorted = [...agents].sort((a, b) => b.activityCount - a.activityCount)

  return (
    <div className="roster-strip">
      {sorted.map((agent) => {
        const isActive = agent.state === 'running' && agent.liveness === 'alive'
        const isError = agent.state === 'error' || agent.errorCount > 0
        const isSelected = selectedAgentId === agent.id

        return (
          <button
            key={agent.id}
            onClick={() => onSelect?.(agent.id)}
            className={`roster-item ${isSelected ? 'roster-selected' : ''}`}
            style={{ borderLeftColor: colorForAgent(agent.id) }}
          >
            <span className={`liveness-dot ${agent.liveness} ${isActive ? 'liveness-pulse' : ''}`} />
            <span className="roster-name">{agent.label}</span>
            {agent.tools.length > 0 && (
              <span className="roster-tools">
                {agent.tools.map((tool) => {
                  const ToolIcon = TOOL_CATEGORY_ICON[tool.category] ?? ICON_MAP.brain
                  return (
                    <span
                      key={tool.name}
                      className={`roster-tool-icon ${tool.active ? '' : 'roster-tool-ghost'}`}
                      title={tool.name}
                    >
                      <ToolIcon size={12} />
                    </span>
                  )
                })}
              </span>
            )}
            <span className="roster-meta">{agent.activityCount} msg</span>
            {isError && <span className="roster-error">err</span>}
          </button>
        )
      })}
    </div>
  )
}
