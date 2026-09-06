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
      json: async () => ({
        content: '---\ntype: person\ntitle: "Dana"\ndescription: Leads the Atlas project.\n---\n\n# Dana\n\nBe precise.',
      }),
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the title, close button, and single-line instance details', () => {
    render(<InstanceDetails instanceInfo={instanceInfo} configGroups={configGroups} resourceHistory={[]} onClose={() => {}} />)

    expect(screen.getByText('Nanoclaw Instance details')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /back to dashboard/i })).toBeInTheDocument()
    expect(screen.getByText('0.3.0')).toBeInTheDocument() // version
    expect(screen.getByText(/^1h 0m/)).toBeInTheDocument() // uptime
    expect(screen.getByText('42.5%')).toBeInTheDocument() // cpu
    expect(screen.getByText('nanoclaw-host · linux · py 3.11.9')).toBeInTheDocument() // host

    // models/agents/skills/tools are no longer in the top row
    expect(screen.queryByText('web-search')).not.toBeInTheDocument()
    expect(screen.queryByText('claude/sonnet')).not.toBeInTheDocument()
    expect(screen.queryByText('Bash')).not.toBeInTheDocument()
  })

  it('shows placeholders when no instance data is available', () => {
    render(<InstanceDetails instanceInfo={null} configGroups={null} resourceHistory={[]} onClose={() => {}} />)
    expect(screen.getByText('Waiting for configuration…')).toBeInTheDocument()
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('renders resource sparklines from the history', () => {
    const history = [
      { t: 1000, cpu: 10, memPct: 20, diskPct: 30 },
      { t: 2000, cpu: 40, memPct: 25, diskPct: 32 },
      { t: 3000, cpu: 60, memPct: 30, diskPct: 35 },
    ]
    render(<InstanceDetails instanceInfo={instanceInfo} configGroups={configGroups} resourceHistory={history} onClose={() => {}} />)

    expect(screen.getAllByText('CPU').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Memory').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Disk').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('60%')).toBeInTheDocument() // latest CPU
    expect(screen.getByText('30%')).toBeInTheDocument() // latest memory
    expect(screen.getByText('35%')).toBeInTheDocument() // latest disk
    // The old metrics bar is gone.
    expect(screen.queryByText('Messages')).not.toBeInTheDocument()
    expect(screen.queryByText('Token buffer')).not.toBeInTheDocument()
  })

  it('shows folders collapsed and expands to reveal files', () => {
    render(<InstanceDetails instanceInfo={instanceInfo} configGroups={configGroups} resourceHistory={[]} onClose={() => {}} />)

    // Folders visible, files hidden until expanded.
    expect(screen.getByRole('button', { name: /coder/ })).toBeInTheDocument()
    expect(screen.queryByText('instructions.prepend.md')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /coder/ }))
    expect(screen.getByText('instructions.prepend.md')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /projects/ })).toBeInTheDocument()
  })

  it('maps top-level groups/container/root folders to their canonical labels', () => {
    const realGroups: ConfigGroup[] = [
      {
        id: 'groups/builder',
        label: 'builder',
        files: [{ id: 'groups/builder/instructions', path: 'groups/builder/instructions.prepend.md', name: 'instructions.prepend.md' }],
      },
      {
        id: 'container/skills/whatsapp-formatting',
        label: 'container/skills/whatsapp-formatting',
        files: [{ id: 'container/skills/whatsapp-formatting/SKILL', path: 'container/skills/whatsapp-formatting/SKILL.md', name: 'SKILL.md' }],
      },
      {
        id: 'root',
        label: 'Root',
        files: [{ id: 'root/AGENTS', path: 'AGENTS.md', name: 'AGENTS.md' }],
      },
    ]
    render(<InstanceDetails instanceInfo={instanceInfo} configGroups={realGroups} resourceHistory={[]} onClose={() => {}} />)

    expect(screen.getByRole('button', { name: /Agents/ })).toBeInTheDocument()
    expect(screen.getByText(/one workspace per agent/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Shared runtime/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Install root/ })).toBeInTheDocument()
  })

  it('sorts the main agent folder to the top with a Main badge', () => {
    const realGroups: ConfigGroup[] = [
      {
        id: 'groups/builder',
        label: 'builder',
        files: [{ id: 'groups/builder/instructions', path: 'groups/builder/instructions.prepend.md', name: 'instructions.prepend.md' }],
      },
      {
        id: 'groups/dm-with-niels',
        label: 'dm-with-niels',
        files: [{ id: 'groups/dm-with-niels/instructions', path: 'groups/dm-with-niels/instructions.prepend.md', name: 'instructions.prepend.md' }],
      },
    ]
    const info: InstanceInfo = {
      ...instanceInfo,
      agents: [
        { id: 'agent:ag-1783159075688-mvnncz', label: 'Marvin', state: 'running', folder: 'dm-with-niels' },
        { id: 'agent:ag-other', label: 'Builder', state: 'idle', folder: 'builder' },
      ],
    }
    render(
      <InstanceDetails instanceInfo={info} configGroups={realGroups} resourceHistory={[]} humanAgentId="agent:ag-1783159075688-mvnncz" onClose={() => {}} />,
    )

    // The Agents folder is expanded by default; the main folder is first with a badge.
    const agentsButton = screen.getByRole('button', { name: /Agents/ })
    expect(agentsButton).toHaveAttribute('aria-expanded', 'true')
    const mainButton = screen.getByRole('button', { name: /dm-with-niels/ })
    expect(mainButton).toBeInTheDocument()
    expect(screen.getByText('Main')).toBeInTheDocument()
    // dm-with-niels renders before builder in the tree.
    const dmButton = screen.getByRole('button', { name: /dm-with-niels/ })
    const builderButton = screen.getByRole('button', { name: /builder/ })
    expect(dmButton.compareDocumentPosition(builderButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('fetches and shows file content when a file is selected', async () => {
    render(<InstanceDetails instanceInfo={instanceInfo} configGroups={configGroups} resourceHistory={[]} onClose={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: /coder/ }))
    fireEvent.click(screen.getByRole('button', { name: 'instructions.prepend.md' }))

    await waitFor(() => expect(screen.getByText(/Be precise\./)).toBeInTheDocument())
    expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining('coder%2Finstructions.prepend.md'))
  })

  it('shows role, description, and frontmatter context for the selected file', async () => {
    render(<InstanceDetails instanceInfo={instanceInfo} configGroups={configGroups} resourceHistory={[]} onClose={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: /coder/ }))
    fireEvent.click(screen.getByRole('button', { name: 'instructions.prepend.md' }))

    // Wait for the fetched content (and its frontmatter) to render.
    await waitFor(() => expect(screen.getByText('Dana')).toBeInTheDocument())

    // Role + description derived from the path.
    expect(screen.getByText('Standing instructions')).toBeInTheDocument()
    expect(screen.getByText(/Role, persona, tone/)).toBeInTheDocument()

    // Frontmatter context from the file content.
    expect(screen.getByText('person')).toBeInTheDocument()
    expect(screen.getByText('Leads the Atlas project.')).toBeInTheDocument()
  })

  it('calls onClose when the back-to-dashboard button is clicked', () => {
    const onClose = vi.fn()
    render(<InstanceDetails instanceInfo={instanceInfo} configGroups={configGroups} resourceHistory={[]} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /back to dashboard/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})