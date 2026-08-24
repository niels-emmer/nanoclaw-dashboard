import { describe, it, expect } from 'vitest'
import { channelName, isHumanChannel } from './channels'

describe('channels', () => {
  it('extracts the channel name', () => {
    expect(channelName('channel:whatsapp')).toBe('whatsapp')
    expect(channelName('agent:marvin')).toBeNull()
  })

  it('treats real human channels as human', () => {
    expect(isHumanChannel('channel:whatsapp')).toBe(true)
    expect(isHumanChannel('channel:matrix')).toBe(true)
    expect(isHumanChannel('channel:telegram')).toBe(true)
  })

  it('does not treat the internal agent channel as human', () => {
    expect(isHumanChannel('channel:agent')).toBe(false)
    expect(isHumanChannel('agent:marvin')).toBe(false)
  })
})
