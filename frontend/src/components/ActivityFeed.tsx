import { colorForEventType, formatTime, readableNodeLabel } from '../lib/utils'
import { TOOL_CATEGORY_ICON } from '../lib/icons'
import { isError, type FeedItem } from '../lib/activityFeed'

interface Props {
  feed: FeedItem[]
  onSelect: (event: FeedItem) => void
}

export function ActivityFeed({ feed, onSelect }: Props) {
  if (feed.length === 0) {
    return (
      <div className="min-h-[80px] grid place-content-center text-center text-muted text-sm">
        <p>Listening for orchestrator activity...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 overflow-y-auto min-h-0 flex-1 pr-1" role="log" aria-live="polite">
      {feed.map((event) => {
        const sourceLabel = event.payload.meta?.sourceLabel ?? readableNodeLabel(event.source)
        const targetLabel = event.payload.meta?.targetLabel ?? readableNodeLabel(event.target)
        const error = isError(event)
        const isTool = event.type === 'activity_update'
        const ToolIcon = isTool && event.payload.current_tool
          ? TOOL_CATEGORY_ICON[event.payload.current_tool.toLowerCase()] ?? null
          : null
        const count = event.count ?? 1

        return (
          <article
            key={event.id}
            onClick={() => onSelect(event)}
            className={`flex items-start gap-3 py-2 border-b border-accent/10 last:border-b-0 cursor-pointer transition-colors hover:bg-accent/5 ${error ? 'bg-red-500/10 rounded-lg px-2' : ''}`}
          >
            {/* Type indicator */}
            <span
              className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0"
              style={{ background: error ? '#ef4444' : colorForEventType(event.type) }}
              aria-hidden
            />

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                {isTool && ToolIcon && <ToolIcon size={13} className="text-accent shrink-0" />}
                <span className="text-[0.65rem] capitalize font-medium px-1.5 py-0.5 rounded" style={{ background: colorForEventType(event.type), color: '#fff' }}>
                  {event.type === 'activity_update' ? 'tool' : event.type.replace('_', ' ')}
                </span>
                <span className="text-xs text-muted truncate">
                  {sourceLabel} <span className="mx-0.5 opacity-60">&rarr;</span> {targetLabel}
                </span>
                <time className="text-xs text-muted ml-auto shrink-0">{formatTime(Date.parse(event.timestamp))}</time>
              </div>
              <p className={`text-sm leading-relaxed line-clamp-2 ${error ? 'text-red-300' : 'text-foreground'}`}>
                {event.payload.summary}
              </p>
              {isTool && event.payload.current_tool && (
                <div className="flex items-center gap-2 text-xs text-muted mt-0.5">
                  <span className="font-mono text-accent">{event.payload.current_tool}</span>
                  {count > 1 && (
                    <span className="text-[0.6rem] font-semibold px-1.5 py-0.5 rounded bg-accent/15 text-accent">
                      ×{count}
                    </span>
                  )}
                  {event.payload.tool_elapsed_ms != null && (
                    <span>{Math.round(event.payload.tool_elapsed_ms / 1000)}s</span>
                  )}
                </div>
              )}
            </div>
          </article>
        )
      })}
    </div>
  )
}
