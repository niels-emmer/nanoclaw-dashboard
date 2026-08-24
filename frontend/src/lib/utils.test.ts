import { describe, it, expect } from 'vitest'
import { deriveLiveness, computeAgentOpacity, parseTopologyMeta, colorForAgent } from './utils'

describe('deriveLiveness', () => {
  it('returns unknown when no data', () => {
    expect(deriveLiveness(null, null)).toBe('unknown')
  })

  it('returns dead when container is stopped', () => {
    expect(deriveLiveness('stopped', 1000)).toBe('dead')
  })

  it('returns stale when container is idle', () => {
    expect(deriveLiveness('idle', 1000)).toBe('stale')
  })

  it('returns alive for a fresh heartbeat', () => {
    expect(deriveLiveness('running', 5000)).toBe('alive')
  })

  it('returns stale for an old heartbeat', () => {
    expect(deriveLiveness('running', 60_000)).toBe('stale')
  })

  it('returns dead for a very old heartbeat', () => {
    expect(deriveLiveness('running', 200_000)).toBe('dead')
  })
})

describe('computeAgentOpacity', () => {
  const now = 1_000_000
  const solid = 15
  const fade = 90

  it('returns 1 within the solid window', () => {
    expect(computeAgentOpacity(now - 1000, solid, fade, now)).toBe(1)
  })

  it('returns 0 after solid + fade elapse', () => {
    const lastUpdated = now - (solid + fade) * 60_000 - 1
    expect(computeAgentOpacity(lastUpdated, solid, fade, now)).toBe(0)
  })

  it('fades linearly through the fade window', () => {
    // Halfway through the fade window
    const lastUpdated = now - solid * 60_000 - (fade / 2) * 60_000
    expect(computeAgentOpacity(lastUpdated, solid, fade, now)).toBeCloseTo(0.5, 5)
  })
})

describe('parseTopologyMeta', () => {
  it('parses channels and a2aEdges', () => {
    const meta = {
      channels: JSON.stringify([{ id: 'telegram', type: 'telegram', agents: ['agent:coder'] }]),
      a2aEdges: JSON.stringify([{ source: 'agent:a', target: 'agent:b' }]),
    }
    const topo = parseTopologyMeta(meta)
    expect(topo?.channels).toHaveLength(1)
    expect(topo?.a2aEdges).toHaveLength(1)
  })

  it('returns null on malformed JSON', () => {
    expect(parseTopologyMeta({ channels: 'not json' })).toBeNull()
  })

  it('returns null on null meta', () => {
    expect(parseTopologyMeta(null)).toBeNull()
  })
})

describe('colorForAgent', () => {
  it('returns pinned brand colors for known agents', () => {
    expect(colorForAgent('agent:researcher')).toBe('#38bdf8')
    expect(colorForAgent('agent:coder')).toBe('#a855f7')
    expect(colorForAgent('agent:architect')).toBe('#f97316')
  })

  it('returns the orchestrator color', () => {
    expect(colorForAgent('orchestrator')).toBe('#f59e0b')
  })

  it('is deterministic for unknown agents', () => {
    expect(colorForAgent('agent:foo')).toBe(colorForAgent('agent:foo'))
  })
})
