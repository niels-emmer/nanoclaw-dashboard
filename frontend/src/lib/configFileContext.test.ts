import { describe, it, expect } from 'vitest'
import { describeConfigFile, parseFrontmatter } from './configFileContext'

describe('describeConfigFile', () => {
  it('identifies standing instructions', () => {
    const ctx = describeConfigFile('groups/builder/instructions.prepend.md')
    expect(ctx.role).toBe('Standing instructions')
    expect(ctx.description).toContain('Role, persona, tone')
  })

  it('identifies the memory map and doctrine', () => {
    expect(describeConfigFile('groups/builder/memory/index.md').role).toBe('Memory map')
    expect(describeConfigFile('groups/builder/memory/system/definition.md').role).toBe('Memory doctrine')
  })

  it('identifies durable memory concept files', () => {
    const ctx = describeConfigFile('groups/dm-with-niels/memory/memories/atlas.md')
    expect(ctx.role).toBe('Durable memory')
    expect(ctx.description).toContain('OKF')
  })

  it('distinguishes shared base from composed CLAUDE.md', () => {
    expect(describeConfigFile('container/CLAUDE.md').role).toBe('Shared base instructions')
    expect(describeConfigFile('groups/builder/CLAUDE.md').role).toBe('Composed project document')
  })

  it('identifies skills, projects, and root AGENTS.md', () => {
    expect(describeConfigFile('container/skills/whatsapp-formatting/SKILL.md').role).toBe('Skill definition')
    expect(describeConfigFile('groups/builder/projects/flow.md').role).toBe('Project file')
    expect(describeConfigFile('AGENTS.md').role).toBe('Root agent instructions')
  })

  it('falls back to a generic description for unknown paths', () => {
    const ctx = describeConfigFile('groups/builder/random-file.md')
    expect(ctx.role).toBe('Configuration file')
  })
})

describe('parseFrontmatter', () => {
  it('parses OKF frontmatter with type, title, description, and tags', () => {
    const content = `---
type: person
title: "Dana"
description: Leads the Atlas project.
tags: ["atlas", "engineering"]
---

# Dana
`
    const fm = parseFrontmatter(content)
    expect(fm).not.toBeNull()
    expect(fm?.type).toBe('person')
    expect(fm?.title).toBe('Dana')
    expect(fm?.description).toBe('Leads the Atlas project.')
    expect(fm?.tags).toEqual(['atlas', 'engineering'])
  })

  it('returns null when there is no frontmatter', () => {
    expect(parseFrontmatter('# Just a heading\n\nNo frontmatter here.')).toBeNull()
  })

  it('handles missing optional fields', () => {
    const fm = parseFrontmatter('---\ntype: note\n---\n\nBody')
    expect(fm?.type).toBe('note')
    expect(fm?.title).toBeUndefined()
  })
})