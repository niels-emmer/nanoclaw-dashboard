import { config } from './config'

// ---- Types (mirror backend/app/backup) ----

export interface BackupCategory {
  id: string
  label: string
}

export interface BackupStatus {
  enabled: boolean
  backup_dir: string
  categories: BackupCategory[]
}

export interface BackupMeta {
  backup_id: string
  filename: string
  script: string
  size: number
  created_at: string | null
  categories: string[]
  schema_version: string | null
  nanoclaw_version: string | null
  encrypted: boolean
  agent_ids: string[]
  notes: string[]
  file_count: number
}

export interface PlanItem {
  category: string
  item: string
  action: 'create' | 'skip' | 'overwrite' | 'replace'
  reason: string
}

export interface RestorePlan {
  items: PlanItem[]
  summary: {
    create: number
    skip: number
    overwrite: number
    replace: number
    total: number
    full_restore: boolean
    schema_version: string | null
    nanoclaw_version: string | null
  }
  text?: string
}

export interface RestoreScriptInfo {
  backup_id: string
  script_path: string
  script: string
}

// ---- API client ----

const api = (path: string) => `${config.apiBaseUrl}/api/backup${path}`

/** Optional shared secret for the backup surface (VITE_BACKUP_TOKEN build arg). */
const backupToken = import.meta.env.VITE_BACKUP_TOKEN as string | undefined

function authHeaders(): Record<string, string> {
  return backupToken ? { 'X-Backup-Token': backupToken } : {}
}

async function jsonFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(api(path), {
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    ...init,
  })
  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const body = (await res.json()) as { detail?: string }
      if (body.detail) detail = body.detail
    } catch {
      // non-JSON error body — keep the status text
    }
    throw new Error(detail)
  }
  return (await res.json()) as T
}

export async function fetchBackupStatus(): Promise<BackupStatus> {
  return jsonFetch<BackupStatus>('/status')
}

export async function createBackup(
  categories: string[],
  agentIds: string[],
  passphrase?: string,
): Promise<BackupMeta> {
  return jsonFetch<BackupMeta>('', {
    method: 'POST',
    body: JSON.stringify({
      categories,
      agent_ids: agentIds.length ? agentIds : undefined,
      passphrase: passphrase || undefined,
    }),
  })
}

export async function listBackups(): Promise<BackupMeta[]> {
  const data = await jsonFetch<{ backups: BackupMeta[] }>('')
  return data.backups
}

export async function fetchRestorePlan(backupId: string): Promise<RestorePlan> {
  return jsonFetch<RestorePlan>('/plan', {
    method: 'POST',
    body: JSON.stringify({ backup_id: backupId }),
  })
}

export async function fetchRestoreScript(backupId: string): Promise<RestoreScriptInfo> {
  return jsonFetch<RestoreScriptInfo>('/restore-script', {
    method: 'POST',
    body: JSON.stringify({ backup_id: backupId }),
  })
}

export function backupDownloadUrl(backupId: string): string {
  return api(`/download/${encodeURIComponent(backupId)}`)
}

/** Download a backup archive as a blob (needed to send the auth header). */
export async function downloadBackup(backupId: string, filename: string): Promise<void> {
  const res = await fetch(backupDownloadUrl(backupId), { headers: authHeaders() })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoke on a delay so the browser has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function formatBackupDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString()
}