/**
 * Context for config-browser files, derived from the nanoclaw docs:
 * - https://docs.nanoclaw.dev/concepts/agent-memory
 * - https://docs.nanoclaw.dev/concepts/entity-model
 * - https://docs.nanoclaw.dev/concepts/container-lifecycle
 *
 * Every file type in the browser has a well-defined role; memory concept files
 * additionally carry their own YAML frontmatter (OKF format) with title,
 * description, type, and tags.
 */

export interface ConfigFileContext {
  role: string
  description: string
}

interface FileRolePattern {
  pattern: RegExp
  role: string
  description: string
}

// Ordered — more specific patterns first (e.g. container/CLAUDE.md before the
// generic composed CLAUDE.md, projects/ before root AGENTS.md).
const FILE_ROLES: FileRolePattern[] = [
  {
    pattern: /^container\/CLAUDE\.md$/,
    role: 'Shared base instructions',
    description: 'Base instructions inlined into every composed project document at spawn.',
  },
  {
    pattern: /instructions\.prepend\.md$/,
    role: 'Standing instructions',
    description: 'Role, persona, tone, and standing behavior for this agent group. Inlined into the composed CLAUDE.md at every spawn.',
  },
  {
    pattern: /memory\/system\/definition\.md$/,
    role: 'Memory doctrine',
    description: 'Explains how the agent stores, retrieves, corrects, and organizes memory. The agent owns this doctrine and can improve it.',
  },
  {
    pattern: /memory\/system\/index\.md$/,
    role: 'Memory index',
    description: 'Folder index for the memory system directory. Not loaded separately.',
  },
  {
    pattern: /memory\/index\.md$/,
    role: 'Memory map',
    description: 'Top-level memory index. The Core Memory section holds the few durable facts useful in nearly every conversation; the rest points to focused concept files.',
  },
  {
    pattern: /\/memory\//,
    role: 'Durable memory',
    description: 'Durable concept file (OKF format). One concept per file, beginning with YAML frontmatter whose first field is type.',
  },
  {
    pattern: /CLAUDE\.local\.md$/,
    role: 'Local overrides',
    description: 'Local CLAUDE configuration overrides for this agent group.',
  },
  {
    pattern: /CLAUDE\.md$/,
    role: 'Composed project document',
    description: 'Regenerated each spawn from all instruction sources (standing instructions, shared base, skills, MCP servers). Do not edit — it is rebuilt automatically.',
  },
  {
    pattern: /skills\/[^/]+\/SKILL\.md$/,
    role: 'Skill definition',
    description: 'Defines a shared skill available to agents (mounted read-only at /app/skills).',
  },
  {
    pattern: /skills\/[^/]+\/instructions\.md$/,
    role: 'Skill instructions',
    description: 'Instructions for a shared skill.',
  },
  {
    pattern: /\/projects\//,
    role: 'Project file',
    description: 'Working file for a project associated with this agent group.',
  },
  {
    pattern: /\.claude-fragments\//,
    role: 'Claude fragments',
    description: 'Reusable instruction fragments for this agent group.',
  },
  {
    pattern: /^AGENTS\.md$/,
    role: 'Root agent instructions',
    description: 'Root-level agent instructions.',
  },
]

const FALLBACK_CONTEXT: ConfigFileContext = {
  role: 'Configuration file',
  description: 'Configuration markdown for this agent group.',
}

/** Derive the role and description of a config file from its path. */
export const describeConfigFile = (path: string): ConfigFileContext => {
  for (const { pattern, role, description } of FILE_ROLES) {
    if (pattern.test(path)) return { role, description }
  }
  return FALLBACK_CONTEXT
}

export interface ConfigFolderContext {
  label: string
  description: string
}

// Top-level folder names in the config tree, mapped to the canonical concepts
// from the nanoclaw docs (installation / entity-model / container-lifecycle).
const FOLDER_CONTEXTS: Record<string, ConfigFolderContext> = {
  groups: {
    label: 'Agents',
    description: 'Agent groups — one workspace per agent (standing instructions, memory, projects).',
  },
  container: {
    label: 'Shared runtime',
    description: 'Shared container image: base instructions, agent-runner source, and skills mounted into every agent.',
  },
  root: {
    label: 'Install root',
    description: 'Top-level files of the nanoclaw install.',
  },
}

/** Better label + description for a top-level config-tree folder, if known. */
export const describeConfigFolder = (name: string): ConfigFolderContext | null =>
  FOLDER_CONTEXTS[name] ?? null

export interface FileFrontmatter {
  title?: string
  description?: string
  type?: string
  tags?: string[]
}

/** Parse YAML frontmatter (OKF format) from a markdown file's content. */
export const parseFrontmatter = (content: string): FileFrontmatter | null => {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) return null
  const out: Record<string, unknown> = {}
  for (const line of match[1].split('\n')) {
    const kv = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/)
    if (!kv) continue
    const key = kv[1]
    const raw = kv[2].trim()
    let value: unknown
    if (raw.startsWith('[') && raw.endsWith(']')) {
      try {
        value = JSON.parse(raw)
      } catch {
        value = raw
      }
    } else {
      value = raw.replace(/^["']|["']$/g, '')
    }
    out[key] = value
  }
  return out as FileFrontmatter
}