const DEFAULT_HOST = 'localhost'
const DEFAULT_HTTP_PORT = 8000

const inferWsUrl = () => {
  const custom = import.meta.env.VITE_BACKEND_WS_URL
  if (custom) return custom
  const current = typeof window !== 'undefined'
    ? window.location
    : ({ protocol: 'http:', hostname: DEFAULT_HOST, port: '5173', host: `${DEFAULT_HOST}:5173` } as Location)
  const proto = current.protocol === 'https:' ? 'wss' : 'ws'
  const host = current.port ? `${current.hostname}:${current.port}` : current.host
  if (current.port === '5173') {
    return `${proto}://${current.hostname}:${DEFAULT_HTTP_PORT}/ws/events`
  }
  return `${proto}://${host}/ws/events`
}

export const config = {
  wsUrl: inferWsUrl(),
  maxEventHistory: Number(import.meta.env.VITE_EVENT_HISTORY ?? 50),
  orchestratorId: 'orchestrator',
}
