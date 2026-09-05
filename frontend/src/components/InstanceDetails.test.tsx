import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { InstanceDetails } from './InstanceDetails'
import type { ConfigGroup, InstanceInfo } from '../lib/types'

const instanceInfo: InstanceInfo = {
  version: '0.3.0',
  uptimeMs: 3_600_000,
  receivedAt: Date.now(),
  host: { hostname: 'nanoclaw-host', platform: 'linux', pythonVersion: '3.11.9', container: 'docker' },
  resources: { cpuPercent: 42.5, memoryUsedMb: 4096, memoryTotalMb: 16384, diskUsedMb: 102400, diskTotalMb: 512000 },
  skills: ['web-search'],
  models: ['claude/sonnet'],
  agents: [{ id: 'agent:coder', label: 'coder', state: 'running' }],
  tools: ['Bash'],
  metrics: {
    messagesTotal: 1234,
    errorsTotal: 3,
    tokenBufferUsed: 45_000,
    tokenBufferLimit: 200_000,
    timeToResetMs: 3_600_000,
    activeAgents: 1,
  },
}

const configGroups: ConfigGroup[] = [
  {
    id: 'coder',
    label: 'coder',
    files: [{ id: 'coder/instructions', path: 'coder/instructions.prepend.md', name: 'instructions.prepend.md' }],
  },
  {
    id: 'coder/projects',
    label: 'coder/projects',
    files: [{ id: 'coder/projects/flow', path: 'coder/projects/flow.md', name: 'flow.md' }],
  },
  {
    id: 'researcher',
    label: 'researcher',
    files: [{ id: 'researcher/instructions', path: 'researcher/instructions.prepend.md', name: 'instructions.prepend.md' }],
  },
]

describe('InstanceDetails', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ content: '# Coder instructions\n\nBe precise.' }),
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the title, close button, and single-line instance details', () => {
    render(<InstanceDetails instanceInfo={instanceInfo} configGroups={configGroups} onClose={() => {}} />)

    expect(screen.getByText('Nanoclaw Instance details')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /back to dashboard/i })).toBeInTheDocument()
    expect(screen.getByText('0.3.0')).toBeInTheDocument() // version
    expect(screen.getByText(/^1h 0m/)).toBeInTheDocument() // uptime
    expect(screen.getByText('42.5%')).toBeInTheDocument() // cpu
    expect(screen.getByText('1,234')).toBeInTheDocument() // messages
    expect(screen.getByText('nanoclaw-host · linux · py 3.11.9 · docker')).toBeInTheDocument() // host

    // models/agents/skills/tools are no longer in the top row
    expect(screen.queryByText('web-search')).not.toBeInTheDocument()
    expect(screen.queryByText('claude/sonnet')).not.toBeInTheDocument()
    expect(screen.queryByText('Bash')).not.toBeInTheDocument()
  })

  it('shows placeholders when no instance data is available', () => {
    render(<InstanceDetails instanceInfo={null} configGroups={null} onClose={() => {}} />)
    expect(screen.getByText('Waiting for configuration…')).toBeInTheDocument()
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('shows folders collapsed and expands to reveal files', () => {
    render(<InstanceDetails instanceInfo={instanceInfo} configGroups={configGroups} onClose={() => {}} />)

    // Folders visible, files hidden until expanded.
    expect(screen.getByRole('button', { name: /coder/ })).toBeInTheDocument()
    expect(screen.queryByText('instructions.prepend.md')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /coder/ }))
    expect(screen.getByText('instructions.prepend.md')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /projects/ })).toBeInTheDocument()
  })

  it('fetches and shows file content when a file is selected', async () => {
    render(<InstanceDetails instanceInfo={instanceInfo} configGroups={configGroups} onClose={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: /coder/ }))
    fireEvent.click(screen.getByRole('button', { name: 'instructions.prepend.md' }))

    await waitFor(() => expect(screen.getByText(/Be precise\./)).toBeInTheDocument())
    expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining('coder%2Finstructions.prepend.md'))
  })

  it('calls onClose when the back-to-dashboard button is clicked', () => {
    const onClose = vi.fn()
    render(<InstanceDetails instanceInfo={instanceInfo} configGroups={configGroups} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /back to dashboard/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})