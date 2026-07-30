const DEFAULT_HOST = 'localhost'
const DEFAULT_HTTP_PORT = 8000
const DEV_PORT = '5173'

const inferWsUrl = () => {
  const custom = import.meta.env.VITE_BACKEND_WS_URL
  if (custom) return custom

  const current = typeof window !== 'undefined'
    ? window.location
    : ({
        protocol: 'http:',
        hostname: DEFAULT_HOST,
        port: DEV_PORT,
        host: `${DEFAULT_HOST}:${DEV_PORT}`,
      } as Location)

  const proto = current.protocol === 'https:' ? 'wss' : 'ws'

  if (current.port === DEV_PORT) {
    return `${proto}://${current.hostname}:${DEFAULT_HTTP_PORT}/ws/events`
  }

  const host = current.hostname
  const portSegment = current.port ? `:${current.port}` : ''
  return `${proto}://${host}${portSegment}/ws/events`
}

export const config = {
  wsUrl: inferWsUrl(),
  maxEventHistory: Number(import.meta.env.VITE_EVENT_HISTORY ?? 200),
  orchestratorId: import.meta.env.VITE_ORCHESTRATOR_ID ?? 'orchestrator',
  agentSolidMinutes: Number(import.meta.env.VITE_AGENT_SOLID_MINUTES ?? 10),
  agentFadeMinutes: Number(import.meta.env.VITE_AGENT_FADE_MINUTES ?? 60),
}
