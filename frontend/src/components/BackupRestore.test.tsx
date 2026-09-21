import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BackupRestore } from './BackupRestore'
import type { InstanceInfo } from '../lib/types'

const instanceInfo: InstanceInfo = {
  version: '0.3.0',
  uptimeMs: 3_600_000,
  receivedAt: Date.now(),
  host: { hostname: 'nanoclaw-host', platform: 'linux', pythonVersion: '3.11.9', container: 'docker' },
  agents: [
    { id: 'agent:ag-main', label: 'Main', state: 'running' },
    { id: 'agent:ag-worker', label: 'Worker', state: 'idle' },
  ],
}

const statusBody = {
  enabled: true,
  backup_dir: '/backups',
  categories: [
    { id: 'full', label: 'Full system' },
    { id: 'agents', label: 'Agents' },
    { id: 'orchestrator', label: 'Orchestrator rules' },
    { id: 'channels', label: 'Channels & wirings' },
    { id: 'users', label: 'Users & roles' },
    { id: 'memory', label: 'Memory' },
    { id: 'tasks', label: 'Scheduled tasks' },
    { id: 'env', label: 'Environment (.env)' },
    { id: 'history', label: 'Conversation history' },
  ],
}

const backupMeta = {
  backup_id: 'backup-20260101-000000',
  filename: 'backup-20260101-000000.tar.gz',
  script: 'backup-20260101-000000.sh',
  size: 4096,
  created_at: '2026-01-01T00:00:00Z',
  categories: ['agents', 'env'],
  schema_version: '24',
  nanoclaw_version: '0.3.0',
  encrypted: true,
  agent_ids: [],
  notes: [],
  file_count: 12,
}

const planBody = {
  items: [
    { category: 'agents', item: 'agent_groups:ag-main', action: 'create', reason: 'new row' },
    { category: 'agents', item: 'agent_groups:ag-worker', action: 'skip', reason: 'already present on target' },
  ],
  summary: {
    create: 1,
    skip: 1,
    overwrite: 0,
    replace: 0,
    total: 2,
    full_restore: false,
    schema_version: '24',
    nanoclaw_version: '0.3.0',
  },
}

function mockFetch(route: (url: string, init?: RequestInit) => unknown) {
  globalThis.fetch = vi.fn((url: unknown, init?: RequestInit) => {
    const result = route(String(url), init)
    return Promise.resolve({
      ok: true,
      json: async () => result,
    })
  }) as unknown as typeof fetch
}

describe('BackupRestore', () => {
  beforeEach(() => {
    mockFetch((url) => {
      if (url.endsWith('/api/backup/status')) return statusBody
      if (url.endsWith('/api/backup')) return { backups: [backupMeta] }
      return {}
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows the unavailable message when nanoclaw is disabled', async () => {
    mockFetch((url) => {
      if (url.endsWith('/api/backup/status')) return { ...statusBody, enabled: false }
      return {}
    })
    render(<BackupRestore instanceInfo={instanceInfo} onClose={() => {}} />)
    await waitFor(() => {
      expect(screen.getByText(/requires a real nanoclaw instance/i)).toBeTruthy()
    })
  })

  it('renders all backup categories', async () => {
    render(<BackupRestore instanceInfo={instanceInfo} onClose={() => {}} />)
    await waitFor(() => {
      expect(screen.getByText('Full system')).toBeTruthy()
      expect(screen.getByText('Orchestrator rules')).toBeTruthy()
      expect(screen.getByText('Channels & wirings')).toBeTruthy()
      expect(screen.getByText('Conversation history')).toBeTruthy()
    })
  })

  it('creates a backup and shows the result', async () => {
    mockFetch((url, init) => {
      if (url.endsWith('/api/backup/status')) return statusBody
      if (url.endsWith('/api/backup') && init?.method === 'POST') return backupMeta
      if (url.endsWith('/api/backup')) return { backups: [backupMeta] }
      return {}
    })
    render(<BackupRestore instanceInfo={instanceInfo} onClose={() => {}} />)
    await waitFor(() => screen.getByText('Full system'))

    fireEvent.click(screen.getByText('Agents'))
    fireEvent.click(screen.getByText('Environment (.env)'))
    fireEvent.change(screen.getByLabelText(/passphrase/i), { target: { value: 'hunter2' } })
    fireEvent.click(screen.getByRole('button', { name: /create backup/i }))

    await waitFor(() => {
      expect(screen.getByText(/backup-20260101-000000\.tar\.gz/)).toBeTruthy()
    })
  })

  it('requires a passphrase when env is selected', async () => {
    render(<BackupRestore instanceInfo={instanceInfo} onClose={() => {}} />)
    await waitFor(() => screen.getByText('Full system'))

    fireEvent.click(screen.getByText('Environment (.env)'))
    const createBtn = screen.getByRole('button', { name: /create backup/i }) as HTMLButtonElement
    expect(createBtn.disabled).toBe(true)

    fireEvent.change(screen.getByLabelText(/passphrase/i), { target: { value: 'pw' } })
    expect(createBtn.disabled).toBe(false)
  })

  it('shows the restore plan for a selected backup', async () => {
    mockFetch((url, init) => {
      if (url.endsWith('/api/backup/status')) return statusBody
      if (url.endsWith('/plan') && init?.method === 'POST') return planBody
      if (url.endsWith('/api/backup')) return { backups: [backupMeta] }
      return {}
    })
    render(<BackupRestore instanceInfo={instanceInfo} onClose={() => {}} />)
    await waitFor(() => screen.getByText(/select a backup/i))

    fireEvent.change(screen.getByLabelText(/select backup/i), { target: { value: backupMeta.backup_id } })
    fireEvent.click(screen.getByRole('button', { name: /show restore plan/i }))

    await waitFor(() => {
      expect(screen.getByText(/agent_groups:ag-main/)).toBeTruthy()
      expect(screen.getByText(/1 create · 1 skip/)).toBeTruthy()
    })
  })

  it('shows the restore script path', async () => {
    mockFetch((url, init) => {
      if (url.endsWith('/api/backup/status')) return statusBody
      if (url.endsWith('/restore-script') && init?.method === 'POST') {
        return { backup_id: backupMeta.backup_id, script_path: '/backups/backup-20260101-000000.sh', script: '#!/usr/bin/env bash\nhelper.cjs' }
      }
      if (url.endsWith('/api/backup')) return { backups: [backupMeta] }
      return {}
    })
    render(<BackupRestore instanceInfo={instanceInfo} onClose={() => {}} />)
    await waitFor(() => screen.getByText(/select a backup/i))

    fireEvent.change(screen.getByLabelText(/select backup/i), { target: { value: backupMeta.backup_id } })
    fireEvent.click(screen.getByRole('button', { name: /get restore script/i }))

    await waitFor(() => {
      expect(screen.getByText(/bash \/backups\/backup-20260101-000000\.sh/)).toBeTruthy()
    })
  })
})