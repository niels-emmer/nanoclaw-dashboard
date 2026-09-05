import { useEffect, useMemo, useState } from 'react'
import { config } from '../lib/config'
import type { ConfigFile, ConfigGroup, InstanceInfo } from '../lib/types'

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

interface ConfigTreeNode {
  name: string
  path: string
  files: ConfigFile[]
  children: Record<string, ConfigTreeNode>
}

/** Build a folder tree from the flat group list (group ids are slash paths). */
const buildConfigTree = (groups: ConfigGroup[]): ConfigTreeNode[] => {
  const roots: ConfigTreeNode[] = []
  const byPath = new Map<string, ConfigTreeNode>()
  for (const group of groups) {
    const parts = group.id.split('/')
    let current: ConfigTreeNode | undefined
    let path = ''
    for (const part of parts) {
      path = path ? `${path}/${part}` : part
      let node = byPath.get(path)
      if (!node) {
        node = { name: part, path, files: [], children: {} }
        byPath.set(path, node)
        if (current) current.children[part] = node
        else roots.push(node)
      }
      current = node
    }
    if (current) current.files = group.files
  }
  return roots
}

interface FolderProps {
  node: ConfigTreeNode
  depth: number
  expanded: Set<string>
  onToggle: (path: string) => void
  selectedFileId: string | null
  onSelectFile: (file: ConfigFile) => void
}

function ConfigFolder({ node, depth, expanded, onToggle, selectedFileId, onSelectFile }: FolderProps) {
  const isExpanded = expanded.has(node.path)
  const childCount = Object.values(node.children).reduce(
    (sum, child) => sum + child.files.length + Object.keys(child.children).length,
    0,
  )
  const total = node.files.length + childCount
  return (
    <div>
      <button
        type="button"
        className="config-folder-row"
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={() => onToggle(node.path)}
        aria-expanded={isExpanded}
      >
        <span className="config-folder-chevron" aria-hidden>{isExpanded ? '▾' : '▸'}</span>
        <span className="config-folder-name">{node.name}</span>
        <span className="config-folder-count">{total}</span>
      </button>
      {isExpanded && (
        <div>
          {node.files.map((file) => (
            <button
              key={file.id}
              type="button"
              className={`config-file-item ${selectedFileId === file.id ? 'config-file-selected' : ''}`}
              style={{ paddingLeft: `${8 + (depth + 1) * 16 + 14}px` }}
              onClick={() => onSelectFile(file)}
            >
              {file.name}
            </button>
          ))}
          {Object.values(node.children).map((child) => (
            <ConfigFolder
              key={child.path}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              selectedFileId={selectedFileId}
              onSelectFile={onSelectFile}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function InstanceDetails({ instanceInfo, configGroups, onClose }: Props) {
  const [now, setNow] = useState(() => Date.now())
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Tick every second so uptime / time-to-reset stay live.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const tree = useMemo(() => (configGroups ? buildConfigTree(configGroups) : []), [configGroups])

  const toggleFolder = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const selectFile = async (file: ConfigFile) => {
    setSelectedFileId(file.id)
    setFileContent(null)
    setLoadError(null)
    setLoading(true)
    try {
      const res = await fetch(`${config.apiBaseUrl}/api/config/file?path=${encodeURIComponent(file.path)}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { content: string }
      setFileContent(data.content)
    } catch {
      setLoadError('Failed to load file content')
    } finally {
      setLoading(false)
    }
  }

  const info = instanceInfo
  const uptimeMs =
    info?.uptimeMs != null && info.receivedAt != null ? info.uptimeMs + (now - info.receivedAt) : null
  const timeToResetMs =
    info?.metrics?.timeToResetMs != null ? Math.max(0, info.metrics.timeToResetMs - (now - (info.receivedAt ?? now))) : null
  const tokenPct =
    info?.metrics?.tokenBufferUsed != null && info.metrics.tokenBufferLimit
      ? Math.min(100, Math.round((info.metrics.tokenBufferUsed / info.metrics.tokenBufferLimit) * 100))
      : null

  const selectedFile = tree.length
    ? (() => {
        const all = configGroups?.flatMap((g) => g.files) ?? []
        return all.find((f) => f.id === selectedFileId) ?? null
      })()
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

      {/* ---- Top row: instance details (single line) ---- */}
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
      </section>

      {/* ---- Middle row: browse configuration ---- */}
      <section className="config-browser" aria-label="Browse configuration">
        <div className="config-browser-header">
          <span className="panel-title">Browse configuration</span>
          {configGroups && (
            <span className="config-file-count">
              {configGroups.length} folders · {configGroups.reduce((sum, g) => sum + g.files.length, 0)} files
            </span>
          )}
        </div>
        <div className="config-browser-body">
          <nav className="config-file-list" aria-label="Configuration files">
            {!configGroups && <p className="config-empty">Waiting for configuration…</p>}
            {tree.map((node) => (
              <ConfigFolder
                key={node.path}
                node={node}
                depth={0}
                expanded={expanded}
                onToggle={toggleFolder}
                selectedFileId={selectedFileId}
                onSelectFile={selectFile}
              />
            ))}
          </nav>
          <div className="config-viewer">
            {selectedFile ? (
              <>
                <div className="config-viewer-header">
                  <span className="config-viewer-path">{selectedFile.path}</span>
                </div>
                {loading && <p className="config-empty">Loading…</p>}
                {loadError && <p className="config-empty">{loadError}</p>}
                {!loading && !loadError && fileContent != null && (
                  <pre className="config-viewer-pre">{fileContent}</pre>
                )}
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