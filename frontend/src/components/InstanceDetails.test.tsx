import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { InstanceDetails } from './InstanceDetails'
import type { ConfigGroup, InstanceInfo } from '../lib/types'

const instanceInfo: InstanceInfo = {
  version: '0.3.0',
  uptimeMs: 3_600_000,
  receivedAt: Date.now(),
  host: { hostname: 'nanoclaw-host', platform: 'linux', pythonVersion: '3.11.9', container: 'docker' },
  resources: { cpuPercent: 42.5, memoryUsedMb: 4096, memoryTotalMb: 16384, diskUsedMb: 102400, diskTotalMb: 512000 },
  skills: ['web-search', 'code-review'],
  models: ['claude/sonnet', 'claude/opus'],
  agents: [
    { id: 'agent:coder', label: 'coder', state: 'running' },
    { id: 'agent:researcher', label: 'researcher', state: 'idle' },
  ],
  tools: ['Bash', 'Read', 'Write'],
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
    id: 'agents',
    label: 'Agents',
    files: [
      { id: 'agents/coder', path: 'agents/coder.md', name: 'coder.md', content: '# Coder\n\nRole: implementation specialist.' },
      { id: 'agents/researcher', path: 'agents/researcher.md', name: 'researcher.md', content: '# Researcher\n\nRole: research specialist.' },
    ],
  },
  {
    id: 'skills',
    label: 'Skills',
    files: [{ id: 'skills/web-search', path: 'skills/web-search.md', name: 'web-search.md', content: '# Web Search\n\nPrefer primary sources.' }],
  },
]

describe('InstanceDetails', () => {
  it('renders the title, close button, and instance details', () => {
    render(<InstanceDetails instanceInfo={instanceInfo} configGroups={configGroups} onClose={() => {}} />)

    expect(screen.getByText('Nanoclaw Instance details')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /back to dashboard/i })).toBeInTheDocument()
    expect(screen.getByText('0.3.0')).toBeInTheDocument()
    expect(screen.getByText('1h 0m 0s')).toBeInTheDocument() // uptime
    expect(screen.getByText('42.5%')).toBeInTheDocument() // cpu
    expect(screen.getByText('web-search')).toBeInTheDocument() // skill chip
    expect(screen.getByText('coder')).toBeInTheDocument() // agent mini
    expect(screen.getByText('1,234')).toBeInTheDocument() // messages
    expect(screen.getByText('nanoclaw-host · linux · py 3.11.9 · docker')).toBeInTheDocument() // host
  })

  it('shows placeholders when no instance data is available', () => {
    render(<InstanceDetails instanceInfo={null} configGroups={null} onClose={() => {}} />)
    expect(screen.getByText('Waiting for configuration…')).toBeInTheDocument()
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('lists config groups and shows the selected file content in the viewer', () => {
    render(<InstanceDetails instanceInfo={instanceInfo} configGroups={configGroups} onClose={() => {}} />)

    // First file of the first group is selected by default.
    expect(screen.getByText(/Role: implementation specialist\./)).toBeInTheDocument()

    // Clicking another file swaps the viewer content.
    fireEvent.click(screen.getByRole('button', { name: 'researcher.md' }))
    expect(screen.getByText(/Role: research specialist\./)).toBeInTheDocument()
    expect(screen.getByText('agents/researcher.md')).toBeInTheDocument()
  })

  it('calls onClose when the back-to-dashboard button is clicked', () => {
    const onClose = vi.fn()
    render(<InstanceDetails instanceInfo={instanceInfo} configGroups={configGroups} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /back to dashboard/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})