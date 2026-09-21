import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  createBackup,
  downloadBackup,
  fetchBackupStatus,
  fetchRestorePlan,
  fetchRestoreScript,
  formatBackupDate,
  formatBytes,
  listBackups,
} from '../lib/backup'
import type { BackupCategory, BackupMeta, RestorePlan, RestoreScriptInfo } from '../lib/backup'
import type { InstanceInfo } from '../lib/types'

interface Props {
  instanceInfo: InstanceInfo | null
  onClose: () => void
}

const ACTION_LABEL: Record<string, string> = {
  create: 'Create',
  skip: 'Skip',
  overwrite: 'Overwrite',
  replace: 'Replace',
}

export function BackupRestore({ instanceInfo, onClose }: Props) {
  const [status, setStatus] = useState<{ enabled: boolean; backup_dir: string; categories: BackupCategory[] } | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)

  // Create-backup state
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [agentIds, setAgentIds] = useState<Set<string>>(new Set())
  const [passphrase, setPassphrase] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [created, setCreated] = useState<BackupMeta | null>(null)

  // Restore state
  const [backups, setBackups] = useState<BackupMeta[]>([])
  const [selectedBackup, setSelectedBackup] = useState<string | null>(null)
  const [plan, setPlan] = useState<RestorePlan | null>(null)
  const [scriptInfo, setScriptInfo] = useState<RestoreScriptInfo | null>(null)
  const [restoreError, setRestoreError] = useState<string | null>(null)
  const [loadingPlan, setLoadingPlan] = useState(false)

  useEffect(() => {
    fetchBackupStatus()
      .then(setStatus)
      .catch((err: Error) => setStatusError(err.message))
  }, [])

  const enabled = status?.enabled ?? false

  const refreshBackups = useCallback(() => {
    listBackups()
      .then(setBackups)
      .catch((err: Error) => setRestoreError(err.message))
  }, [])

  useEffect(() => {
    if (enabled) refreshBackups()
  }, [enabled, refreshBackups])

  const agents = useMemo(() => instanceInfo?.agents ?? [], [instanceInfo])

  const toggleCategory = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (id === 'full') {
        // Full system implies everything; unchecking it clears the rest.
        return next.has('full') ? new Set() : new Set(['full'])
      }
      if (next.has('full')) return next // full already selected — ignore
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAgent = (id: string) => {
    setAgentIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const needsPassphrase = selected.has('env') || selected.has('full')
  const canCreate = selected.size > 0 && (!needsPassphrase || passphrase.length > 0)

  const handleCreate = async () => {
    setCreating(true)
    setCreateError(null)
    setCreated(null)
    try {
      const meta = await createBackup([...selected], [...agentIds], needsPassphrase ? passphrase : undefined)
      setCreated(meta)
      setPassphrase('')
      refreshBackups()
    } catch (err) {
      setCreateError((err as Error).message)
    } finally {
      setCreating(false)
    }
  }

  const handleShowPlan = async () => {
    if (!selectedBackup) return
    const requested = selectedBackup
    setLoadingPlan(true)
    setRestoreError(null)
    setPlan(null)
    setScriptInfo(null)
    try {
      const result = await fetchRestorePlan(requested)
      // Ignore stale responses if the selection changed mid-flight.
      if (selectedBackup === requested) setPlan(result)
    } catch (err) {
      if (selectedBackup === requested) setRestoreError((err as Error).message)
    } finally {
      if (selectedBackup === requested) setLoadingPlan(false)
    }
  }

  const handleGetScript = async () => {
    if (!selectedBackup) return
    const requested = selectedBackup
    setRestoreError(null)
    try {
      const result = await fetchRestoreScript(requested)
      if (selectedBackup === requested) setScriptInfo(result)
    } catch (err) {
      if (selectedBackup === requested) setRestoreError((err as Error).message)
    }
  }

  if (statusError) {
    return (
      <div className="backup-panel">
        <header className="backup-header">
          <span className="panel-title">Backup &amp; restore</span>
          <button type="button" className="instance-close" onClick={onClose} aria-label="Back to instance details">
            <span aria-hidden>✕</span> Back
          </button>
        </header>
        <p className="config-empty">{statusError}</p>
      </div>
    )
  }

  if (!status) {
    return (
      <div className="backup-panel">
        <header className="backup-header">
          <span className="panel-title">Backup &amp; restore</span>
          <button type="button" className="instance-close" onClick={onClose} aria-label="Back to instance details">
            <span aria-hidden>✕</span> Back
          </button>
        </header>
        <p className="config-empty">Loading…</p>
      </div>
    )
  }

  if (!enabled) {
    return (
      <div className="backup-panel">
        <header className="backup-header">
          <span className="panel-title">Backup &amp; restore</span>
          <button type="button" className="instance-close" onClick={onClose} aria-label="Back to instance details">
            <span aria-hidden>✕</span> Back
          </button>
        </header>
        <p className="config-empty">
          Backup requires a real nanoclaw instance. Start the backend with{' '}
          <code>NANOCLAW_ENABLED=true</code> and a read-only mount of the nanoclaw data folder.
        </p>
      </div>
    )
  }

  return (
    <div className="backup-panel">
      <header className="backup-header">
        <span className="panel-title">Backup &amp; restore</span>
        <span className="backup-dir">{status ? `writes to ${status.backup_dir}` : ''}</span>
        <button type="button" className="instance-close" onClick={onClose} aria-label="Back to instance details">
          <span aria-hidden>✕</span> Back
        </button>
      </header>

      <div className="backup-body">
        {/* ---- Create ---- */}
        <section className="backup-section" aria-label="Create backup">
          <h2 className="backup-section-title">Create backup</h2>
          <div className="backup-categories">
            {status.categories.map((cat) => (
              <label key={cat.id} className={`backup-cat ${selected.has('full') && cat.id !== 'full' ? 'backup-cat-muted' : ''}`}>
                <input
                  type="checkbox"
                  checked={selected.has(cat.id)}
                  onChange={() => toggleCategory(cat.id)}
                  disabled={selected.has('full') && cat.id !== 'full'}
                />
                <span>{cat.label}</span>
              </label>
            ))}
          </div>

          {selected.has('agents') && !selected.has('full') && (
            <div className="backup-agents">
              <p className="backup-hint">
                {agentIds.size === 0
                  ? 'All agents (no specific selection).'
                  : `${agentIds.size} specific agent${agentIds.size > 1 ? 's' : ''} selected.`}
              </p>
              <div className="backup-agent-list">
                {agents.map((agent) => (
                  <label key={agent.id} className="backup-agent">
                    <input
                      type="checkbox"
                      checked={agentIds.has(agent.id)}
                      onChange={() => toggleAgent(agent.id)}
                    />
                    <span>{agent.label}</span>
                    <span className="backup-agent-id">{agent.id}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {needsPassphrase && (
            <div className="backup-passphrase">
              <label htmlFor="backup-passphrase">Passphrase (encrypts .env secrets)</label>
              <input
                id="backup-passphrase"
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="Required — .env contains API keys"
                autoComplete="new-password"
              />
            </div>
          )}

          {createError && <p className="backup-error">{createError}</p>}

          <div className="backup-actions">
            <button
              type="button"
              className="backup-button"
              disabled={!canCreate || creating}
              onClick={handleCreate}
            >
              {creating ? 'Creating…' : 'Create backup'}
            </button>
          </div>

          {created && (
            <div className="backup-result">
              <p>
                <strong>{created.filename}</strong> · {formatBytes(created.size)} ·{' '}
                {created.categories.join(', ')}
                {created.encrypted ? ' · encrypted' : ''}
              </p>
              <p className="backup-hint">
                Archive and restore script are stored in <code>backups/</code> on the host. You can{' '}
                <button
                  type="button"
                  className="backup-link"
                  onClick={() => downloadBackup(created.backup_id, created.filename).catch((err: Error) => setCreateError(err.message))}
                >
                  download the archive
                </button>{' '}
                for off-host storage.
              </p>
            </div>
          )}
        </section>

        {/* ---- Restore ---- */}
        <section className="backup-section" aria-label="Restore backup">
          <h2 className="backup-section-title">Restore</h2>
          {backups.length === 0 ? (
            <p className="backup-hint">No backups yet — create one above.</p>
          ) : (
            <>
              <select
                className="backup-select"
                value={selectedBackup ?? ''}
                onChange={(e) => {
                  setSelectedBackup(e.target.value || null)
                  setPlan(null)
                  setScriptInfo(null)
                }}
                aria-label="Select backup"
              >
                <option value="">Select a backup…</option>
                {backups.map((b) => (
                  <option key={b.backup_id} value={b.backup_id}>
                    {formatBackupDate(b.created_at)} — {b.categories.join(', ')} ({formatBytes(b.size)})
                  </option>
                ))}
              </select>

              <div className="backup-actions">
                <button
                  type="button"
                  className="backup-button"
                  disabled={!selectedBackup || loadingPlan}
                  onClick={handleShowPlan}
                >
                  {loadingPlan ? 'Analyzing…' : 'Show restore plan'}
                </button>
                <button
                  type="button"
                  className="backup-button backup-button-secondary"
                  disabled={!selectedBackup}
                  onClick={handleGetScript}
                >
                  Get restore script
                </button>
              </div>

              {restoreError && <p className="backup-error">{restoreError}</p>}

              {plan && (
                <div className="backup-plan">
                  <p className="backup-hint">
                    {plan.summary.full_restore
                      ? 'Full-system restore — replaces the central database.'
                      : 'Partial import — merges the selected categories.'}{' '}
                    {plan.summary.create} create · {plan.summary.skip} skip · {plan.summary.overwrite}{' '}
                    overwrite · {plan.summary.replace} replace
                    {plan.summary.schema_version ? ` · schema v${plan.summary.schema_version}` : ''}
                  </p>
                  <ul className="backup-plan-list">
                    {plan.items.slice(0, 60).map((item, i) => (
                      <li key={i} className={`backup-plan-item backup-plan-${item.action}`}>
                        <span className="backup-plan-action">{ACTION_LABEL[item.action]}</span>
                        <span className="backup-plan-item-name">{item.item}</span>
                        <span className="backup-plan-reason">{item.reason}</span>
                      </li>
                    ))}
                    {plan.items.length > 60 && (
                      <li className="backup-hint">…and {plan.items.length - 60} more items</li>
                    )}
                  </ul>
                </div>
              )}

              {scriptInfo && (
                <div className="backup-script">
                  <p className="backup-hint">
                    Run this on the nanoclaw host (the archive sits next to the script in{' '}
                    <code>backups/</code>):
                  </p>
                  <pre className="backup-script-path">bash {scriptInfo.script_path}</pre>
                  <details>
                    <summary>View restore script</summary>
                    <pre className="backup-script-pre">{scriptInfo.script}</pre>
                  </details>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  )
}