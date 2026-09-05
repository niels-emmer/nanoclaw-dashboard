import { useEffect, useMemo, useState } from 'react'
import type { ConfigGroup, InstanceInfo } from '../lib/types'

interface Props {
  instanceInfo: InstanceInfo | null
  configGroups: ConfigGroup[] | null
  onClose: () => void
}

const formatUptime = (ms: number): string => {
  const s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m ${s % 60}s`
  if (m > 0) return `${m}m ${s % 60}s`
  return `${s}s`
}

const formatCountdown = (ms: number): string => {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}h ${m}m ${sec}s`
  if (m > 0) return `${m}m ${sec}s`
  return `${sec}s`
}

function ResourceBar({ label, used, total, unit }: { label: string; used?: number; total?: number; unit: string }) {
  if (used == null || total == null || total <= 0) {
    return (
      <div className="detail-cell">
        <span className="detail-label">{label}</span>
        <span className="text-sm text-muted">—</span>
      </div>
    )
  }
  const pct = Math.min(100, Math.round((used / total) * 100))
  return (
    <div className="detail-cell">
      <span className="detail-label">{label}</span>
      <span className="text-sm">
        {used.toLocaleString()} / {total.toLocaleString()} {unit}
      </span>
      <div className="resource-bar">
        <div className="resource-bar-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function ChipList({ items }: { items: string[] }) {
  if (!items.length) return <span className="text-sm text-muted">—</span>
  return (
    <div className="chip-list">
      {items.map((item) => (
        <span key={item} className="chip">
          {item}
        </span>
      ))}
    </div>
  )
}

export function InstanceDetails({ instanceInfo, configGroups, onClose }: Props) {
  const [now, setNow] = useState(() => Date.now())
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null)

  // Tick every second so uptime / time-to-reset stay live.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const allFiles = useMemo(() => configGroups?.flatMap((g) => g.files) ?? [], [configGroups])
  // If the selected file disappears in a newer config snapshot, fall back to the
  // first file so the viewer and the highlighted list item stay in sync.
  const effectiveSelectedId = allFiles.some((f) => f.id === selectedFileId)
    ? selectedFileId
    : (allFiles[0]?.id ?? null)
  const selectedFile = useMemo(
    () => allFiles.find((f) => f.id === effectiveSelectedId) ?? null,
    [allFiles, effectiveSelectedId],
  )

  const info = instanceInfo
  const uptimeMs =
    info?.uptimeMs != null && info.receivedAt != null ? info.uptimeMs + (now - info.receivedAt) : null
  const timeToResetMs =
    info?.metrics?.timeToResetMs != null ? Math.max(0, info.metrics.timeToResetMs - (now - (info.receivedAt ?? now))) : null
  const tokenPct =
    info?.metrics?.tokenBufferUsed != null && info.metrics.tokenBufferLimit
      ? Math.min(100, Math.round((info.metrics.tokenBufferUsed / info.metrics.tokenBufferLimit) * 100))
      : null

  return (
    <div className="instance-overlay">
      <header className="instance-header">
        <div className="instance-title">
          <span className="instance-title-dot" aria-hidden />
          <h1>Nanoclaw Instance details</h1>
        </div>
        <button type="button" className="instance-close" onClick={onClose} aria-label="Back to dashboard">
          <span aria-hidden>✕</span> Back to dashboard
        </button>
      </header>

      {/* ---- Top row: instance details ---- */}
      <section className="instance-details-row" aria-label="Instance details">
        <div className="detail-cell">
          <span className="detail-label">Version</span>
          <span className="text-sm">{info?.version ?? '—'}</span>
        </div>
        <div className="detail-cell">
          <span className="detail-label">Uptime</span>
          <span className="text-sm">{uptimeMs != null ? formatUptime(uptimeMs) : '—'}</span>
        </div>
        <div className="detail-cell">
          <span className="detail-label">CPU</span>
          <span className="text-sm">{info?.resources?.cpuPercent != null ? `${info.resources.cpuPercent}%` : '—'}</span>
        </div>
        <ResourceBar label="Memory" used={info?.resources?.memoryUsedMb} total={info?.resources?.memoryTotalMb} unit="MB" />
        <ResourceBar label="Disk" used={info?.resources?.diskUsedMb} total={info?.resources?.diskTotalMb} unit="MB" />
        <div className="detail-cell detail-cell-wide">
          <span className="detail-label">Skills</span>
          <ChipList items={info?.skills ?? []} />
        </div>
        <div className="detail-cell detail-cell-wide">
          <span className="detail-label">Models</span>
          <ChipList items={info?.models ?? []} />
        </div>
        <div className="detail-cell detail-cell-wide">
          <span className="detail-label">Agents</span>
          {info?.agents?.length ? (
            <div className="agent-mini-list">
              {info.agents.map((a) => (
                <span key={a.id} className="agent-mini">
                  <span className={`agent-mini-dot ${a.state}`} aria-hidden />
                  {a.label}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-sm text-muted">—</span>
          )}
        </div>
        <div className="detail-cell detail-cell-wide">
          <span className="detail-label">Tools</span>
          <ChipList items={info?.tools ?? []} />
        </div>
      </section>

      {/* ---- Middle row: browse configuration ---- */}
      <section className="config-browser" aria-label="Browse configuration">
        <div className="config-browser-header">
          <span className="panel-title">Browse configuration</span>
          {configGroups && (
            <span className="config-file-count">
              {configGroups.length} groups · {allFiles.length} files
            </span>
          )}
        </div>
        <div className="config-browser-body">
          <nav className="config-file-list" aria-label="Configuration files">
            {!configGroups && <p className="config-empty">Waiting for configuration…</p>}
            {configGroups?.map((group) => (
              <div key={group.id} className="config-group">
                <span className="config-group-label">{group.label}</span>
                {group.files.map((file) => (
                  <button
                    key={file.id}
                    type="button"
                    className={`config-file-item ${selectedFile?.id === file.id ? 'config-file-selected' : ''}`}
                    onClick={() => setSelectedFileId(file.id)}
                  >
                    {file.name}
                  </button>
                ))}
              </div>
            ))}
          </nav>
          <div className="config-viewer">
            {selectedFile ? (
              <>
                <div className="config-viewer-header">
                  <span className="config-viewer-path">{selectedFile.path}</span>
                </div>
                <pre className="config-viewer-pre">{selectedFile.content}</pre>
              </>
            ) : (
              <p className="config-empty">Select a file to view its contents.</p>
            )}
          </div>
        </div>
      </section>

      {/* ---- Bottom bar: metrics ---- */}
      <footer className="metrics-bar" aria-label="Metrics">
        <div className="metrics-cell">
          <span className="detail-label">Messages</span>
          <span className="metrics-value">{info?.metrics?.messagesTotal?.toLocaleString() ?? '—'}</span>
        </div>
        <div className="metrics-cell">
          <span className="detail-label">Errors</span>
          <span className="metrics-value">{info?.metrics?.errorsTotal?.toLocaleString() ?? '—'}</span>
        </div>
        <div className="metrics-cell metrics-cell-grow">
          <span className="detail-label">Token buffer</span>
          {tokenPct != null ? (
            <div className="token-buffer">
              <div className="resource-bar">
                <div className="resource-bar-fill" style={{ width: `${tokenPct}%` }} />
              </div>
              <span className="metrics-value">
                {info?.metrics?.tokenBufferUsed?.toLocaleString()} / {info?.metrics?.tokenBufferLimit?.toLocaleString()}
              </span>
            </div>
          ) : (
            <span className="metrics-value">—</span>
          )}
        </div>
        <div className="metrics-cell">
          <span className="detail-label">Time to reset</span>
          <span className="metrics-value">{timeToResetMs != null ? formatCountdown(timeToResetMs) : '—'}</span>
        </div>
        <div className="metrics-cell metrics-cell-grow">
          <span className="detail-label">Host</span>
          <span className="metrics-value">
            {info?.host?.hostname ?? '—'}
            {info?.host?.platform ? ` · ${info.host.platform}` : ''}
            {info?.host?.pythonVersion ? ` · py ${info.host.pythonVersion}` : ''}
            {info?.host?.container ? ` · ${info.host.container}` : ''}
          </span>
        </div>
      </footer>
    </div>
  )
}