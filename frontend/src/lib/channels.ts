// Real human-facing channels. "agent" and other internal channels are excluded
// so agent-to-agent traffic is never treated as human communication.
export const HUMAN_CHANNELS = new Set(['whatsapp', 'matrix', 'telegram', 'signal', 'slack', 'discord', 'email', 'sms'])

/** Return the channel name if the id is a channel endpoint, else null. */
export function channelName(id: string): string | null {
  return id.startsWith('channel:') ? id.slice('channel:'.length) : null
}

/** True if the id is a real human-facing channel endpoint. */
export function isHumanChannel(id: string): boolean {
  const name = channelName(id)
  return name ? HUMAN_CHANNELS.has(name) : false
}
