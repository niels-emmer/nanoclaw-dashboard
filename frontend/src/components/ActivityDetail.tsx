import type { FeedItem } from '../lib/activityFeed'
import { isError } from '../lib/activityFeed'
import { colorForEventType, formatTime, readableNodeLabel } from '../lib/utils'
import { TOOL_CATEGORY_ICON } from '../lib/icons'

interface Props {
  event: FeedItem
  onClose: () => void
}

export function ActivityDetail({ event, onClose }: Props) {
  const accent = colorForEventType(event.type)
  const error = isError(event)
  const isTool = event.type === 'activity_update'
  const ToolIcon = isTool && event.payload.current_tool
    ? TOOL_CATEGORY_ICON[event.payload.current_tool.toLowerCase()] ?? null
    : null
  const count = event.count ?? 1

  const metaRows: Array<[string, string]> = []
  if (event.payload.status) metaRows.push(['Status', event.payload.status])
  if (isTool && event.payload.current_tool) metaRows.push(['Tool', event.payload.current_tool])
  if (event.payload.tool_elapsed_ms != null) metaRows.push(['Tool elapsed', `${Math.round(event.payload.tool_elapsed_ms / 1000)}s`])
  if (event.payload.tool_timeout_ms != null) metaRows.push(['Tool timeout', `${Math.round(event.payload.tool_timeout_ms / 1000)}s`])
  if (event.payload.duration_ms != null) metaRows.push(['Duration', `${Math.round(event.payload.duration_ms / 1000)}s`])
  if (event.payload.retry_count != null) metaRows.push(['Retries', String(event.payload.retry_count)])
  if (event.payload.delivery_status) metaRows.push(['Delivery', event.payload.delivery_status])
  if (event.payload.approval_action) metaRows.push(['Approval', event.payload.approval_action])
  if (event.payload.approval_title) metaRows.push(['Approval title', event.payload.approval_title])
  if (count > 1) metaRows.push(['Occurrences', `×${count}`])

  const metaEntries = event.payload.meta ? Object.entries(event.payload.meta) : []

  return (
    <div className="agent-detail-overlay" onClick={onClose}>
      <div className="agent-detail" onClick={(e) => e.stopPropagation()} style={{ borderTopColor: error ? '#ef4444' : accent }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: error ? '#ef4444' : accent }} aria-hidden />
            {isTool && ToolIcon && <ToolIcon size={16} className="text-accent" />}
            <h2 className="text-lg font-semibold capitalize" style={{ color: error ? '#ef4444' : accent }}>
              {isTool ? 'Tool activity' : event.type.replace('_', ' ')}
            </h2>
          </div>
          <button onClick={onClose} className="text-muted hover:text-foreground text-sm">✕</button>
        </div>

        <div className="text-sm text-muted mb-3">
          {readableNodeLabel(event.source)} <span className="opacity-60">&rarr;</span> {readableNodeLabel(event.target)}
          <span className="ml-2">{formatTime(Date.parse(event.timestamp))}</span>
        </div>

        <div className="mb-3">
          <span className="detail-label block mb-1">Message</span>
          <p className={`text-sm leading-relaxed whitespace-pre-wrap break-words ${error ? 'text-red-300' : 'text-foreground'}`}>
            {event.payload.summary}
          </p>
        </div>

        {metaRows.length > 0 && (
          <div className="grid grid-cols-2 gap-2 text-sm mb-3">
            {metaRows.map(([label, value]) => (
              <div key={label} className="detail-cell">
                <span className="detail-label">{label}</span>
                <span className="break-words">{value}</span>
              </div>
            ))}
          </div>
        )}

        {metaEntries.length > 0 && (
          <div>
            <span className="detail-label block mb-1">Metadata</span>
            <div className="flex flex-col gap-1.5">
              {metaEntries.map(([k, v]) => (
                <div key={k} className="text-xs text-muted border-b border-accent/10 pb-1.5">
                  <span className="font-mono text-accent">{k}</span>
                  <span className="ml-2 break-words">{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
