# Nanoclaw Dashboard Backend API

> Machine-readable description for agent integration. Keep this file current — agents read it instead of probing the service.

Base URL: `http://localhost:8000` (Docker: `${BACKEND_PORT:-8000}`)
Auth: none (deploy behind a trusted network/VPN — see `docs/threat-models/2026-07-25.md`)
Version: 2026-08-29

## OpenAPI spec

The service is FastAPI and serves a machine-generated OpenAPI 3.1 spec at the conventional path:

- **Spec**: `GET /openapi.json`
- **Swagger UI**: `GET /docs`
- **ReDoc**: `GET /redoc`

Note: the spec covers both HTTP routes and the `/ws/events` WebSocket endpoint (documented as a `get` operation with a `101` response, since OpenAPI cannot express WebSocket semantics natively). This file is the source of truth for the full WebSocket protocol.

## Endpoints

### GET /health

Liveness probe. Returns `{ "status": "ok" }`.

Params: none

Example:

```bash
curl -X GET "http://localhost:8000/health"
# {"status":"ok"}
```

### WS /ws/events

WebSocket stream of canonical telemetry events (orchestrator → agents → sub-agents conversation). This is the main data channel consumed by the frontend SPA.

**Connection**

- URL: `ws://localhost:8000/ws/events` (or `wss://` behind TLS)
- Origin validation: the `Origin` header must be loopback (`localhost`, `127.0.0.1`, `::1`), a `.local` mDNS host, a private/LAN IP, or match the `Host` header. Rejected origins are accepted then immediately closed with WebSocket close code **4003**.
- On connect, the server flushes the buffered event history (up to `NANOCLAW_EVENT_BUFFER_SIZE`, default 100 events) before streaming live events.
- Max concurrent clients: `NANOCLAW_MAX_CLIENTS` (default 50). Excess connections are also accepted then closed with code 4003.
- Clients are read-only: the server ignores inbound text frames.

**Message shape** (JSON, one event per frame):

```json
{
  "id": "uuid",
  "timestamp": "ISO-8601",
  "type": "question",
  "source": "agent:researcher",
  "target": "orchestrator",
  "payload": { "summary": "...", "status": "running", "current_tool": "Bash" },
  "agent_state": "running",
  "schema_version": "0.2.0"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Globally unique event identifier |
| `timestamp` | string | ISO-8601 timestamp |
| `type` | enum | See event types below |
| `source` | string | Sender node id (e.g. `agent:researcher`, `orchestrator`, `human:whatsapp`) |
| `target` | string | Recipient node id |
| `payload` | object | `summary` (max 240 chars), `status`, optional `duration_ms`, `meta`, tool state (`current_tool`, `tool_elapsed_ms`, `tool_timeout_ms`), capabilities (`provider`, `model`, `skills`), liveness (`container_status`, `heartbeat_age_ms`), delivery (`retry_count`, `delivery_status`), approvals (`approval_action`, `approval_title`) |
| `agent_state` | enum \| null | `spinning_up`, `idle`, `running`, `error` |
| `schema_version` | string | Event schema version (bump on breaking changes) |

**Event types** (`type` field):

| Type | Meaning |
|------|---------|
| `question` | Agent asks a question |
| `response` | Agent answers |
| `agent_status` | Agent state change |
| `activity_update` | Tool/activity progress |
| `delivery_update` | Message delivery outcome |
| `approval_pending` | Approval request awaiting human action |
| `topology_snapshot` | Full agent hierarchy snapshot |

**Channel routing convention**: `source`/`target` ids of the form `channel:<name>` (e.g. `human:whatsapp`, `human:matrix`) are real human channels and route to the Human node; `channel:agent` is internal and routes to the orchestrator.

Example (Python, `websockets`):

```python
import asyncio, json
import websockets

async def main():
    async with websockets.connect(
        "ws://localhost:8000/ws/events", origin="http://localhost:5173"
    ) as ws:
        while True:
            event = json.loads(await ws.recv())
            print(event["type"], event["source"], "->", event["target"])

asyncio.run(main())
```

## Conventions

- **Errors**: HTTP routes return FastAPI's default `{ "detail": "..." }` shape with 4xx/5xx status. WebSocket origin rejections and excess connections are accepted then closed with code `4003`.
- **Rate limits**: none enforced.
- **Idempotency**: all endpoints are read-only (GET / WebSocket subscribe). No state-mutating routes exist.
- **Schema source of truth**: `backend/app/telemetry/models.py` (Pydantic models). Frontend mirrors it in `frontend/src/lib/types.ts`. Bump `schema_version` on breaking changes.
- **Config**: all settings via env vars prefixed `NANOCLAW_` (see `backend/app/config.py` and `.env.example`).