# Nanoclaw Dashboard Backend API

> Machine-readable description for agent integration. Keep this file current — agents read it instead of probing the service.

Base URL: `http://localhost:8000` (Docker: `${BACKEND_PORT:-8000}`)
Auth: none by default (deploy behind a trusted network/VPN — see `docs/threat-models/2026-07-25.md`); the backup surface additionally supports an optional shared secret (`NANOCLAW_BACKUP_TOKEN` → `X-Backup-Token` header)
Version: 2026-09-21

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
  "schema_version": "0.3.0"
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
| `instance_info` | Instance details + metrics snapshot (periodic) |
| `config_snapshot` | User/group configuration files (periodic) |

**Snapshot payloads** (`instance_info` / `config_snapshot`) carry their structured data as JSON-encoded strings in `payload.meta`, mirroring the `topology_snapshot` convention:

- `instance_info` → `meta.instance` — JSON object with `version`, `uptimeMs`, `host` (`hostname`, `platform`, `pythonVersion`, `container`), `resources` (`cpuPercent`, `memoryUsedMb`, `memoryTotalMb`, `diskUsedMb`, `diskTotalMb`), `skills[]`, `models[]` (`provider/model`), `agents[]` (`id`, `label`, `folder`, `state` — `folder` is the config folder name linking the agent to its `groups/<folder>` tree), `tools[]`, and `metrics` (`messagesTotal`, `errorsTotal`, `tokenBufferUsed`, `tokenBufferLimit`, `timeToResetMs`, `activeAgents`). Fields may be absent when the source cannot provide them (e.g. token metrics on the real nanoclaw source).
- `config_snapshot` → `meta.groups` — JSON array of groups (`id`, `label`, `files[]`), each file with `id`, `path`, and `name` (**metadata only — no content**). The real source collects config-relevant markdown only — the `groups/` subtree (agent instructions, memory, projects), the `container/` subtree (shared CLAUDE.md, skills, excluding `agent-runner` source), and root-level `*.md` (AGENTS.md, CLAUDE.md) — grouped by directory with the `groups/` prefix stripped from labels. Conversation logs are excluded. File contents are fetched on demand via `GET /api/config/file`.

Both snapshot types are emitted periodically by the mock source (~10/40 ticks) and the real nanoclaw source (~15/60 ticks, plus once on connect) and are excluded from the frontend activity history.

### GET /api/config/file

Serves a single config file's content for the instance-details browser (the `config_snapshot` event carries metadata only).

- Query param: `path` — the file's relative path under the nanoclaw root (e.g. `groups/builder/instructions.prepend.md`).
- Response: `{ "path": "...", "name": "...", "content": "..." }` (content capped at 20 KB).
- Security: origin validated like the WebSocket endpoint (403 on disallowed origin); path traversal and non-`.md` files rejected (404); only files under the nanoclaw root are served. In mock mode it serves the generated mock config files.

### Backup / restore (`/api/backup/*`)

Backup and restore of nanoclaw configuration. Backups read the read-only nanoclaw mount and write archives + restore scripts into the dashboard's writable backup folder (`NANOCLAW_BACKUP_DIR`, mounted at `/backups` in Docker). Restore is executed by a host-side `restore.sh` generated next to each archive — the dashboard never writes to the nanoclaw data folder.

All endpoints are origin-validated like `/api/config/file` (403 on disallowed origin). When `NANOCLAW_BACKUP_TOKEN` is set, every backup request must also carry it in the `X-Backup-Token` header (401 otherwise). `GET /api/backup/status` returns **200 with `enabled: false`** in mock mode; the other five endpoints return **503** when `NANOCLAW_ENABLED=false`.

**Categories** (`full`, `agents`, `orchestrator`, `channels`, `users`, `memory`, `tasks`, `env`, `history`):

| Category | Contents |
|----------|----------|
| `full` | Everything below + raw `data/v2.db` + `container/CLAUDE.md` |
| `agents` | `agent_groups`, `container_configs`, `agent_destinations`, `agent_message_policies`, scoped `user_roles`/`agent_group_members`, and `groups/<folder>/` files (excludes generated `CLAUDE.md`/`container.json`). With `agent_ids` → only those groups. **Configuration only**: working data (`work`/`repos`/`projects`/`conversations`), transient dirs (`.pnpm-store`, `.claude-fragments`, `.claude-shared`), build caches (`.next`, `dist`, `build`, `.cache`), and files over 10 MiB are excluded (skipped files are listed in the manifest `notes`). |
| `orchestrator` | `agent_destinations`, `agent_message_policies`, `messaging_groups`, `messaging_group_agents`, `user_dms`, plus the orchestrator group's folder |
| `channels` | `messaging_groups`, `messaging_group_agents`, `user_dms` |
| `users` | `users`, `user_roles`, `agent_group_members` |
| `memory` | `groups/*/memory/` trees |
| `tasks` | `kind='task'` rows from session mailboxes (with session routing) |
| `env` | `.env` — **requires a passphrase**; encrypted with openssl AES-256-CBC (PBKDF2) |
| `history` | `data/v2-sessions/` (conversation history, opt-in) |

**`GET /api/backup/status`** — `{ "enabled": bool, "backup_dir": str, "categories": [{id, label}] }`. Returns 200 with `enabled: false` in mock mode.

**`POST /api/backup`** — body `{ "categories": [...], "agent_ids"?: [...], "passphrase"?: str }`. Creates an archive `backup-<ts>.tar.gz` + executable `backup-<ts>.sh` in the backup folder. Returns metadata (`backup_id`, `filename`, `script`, `size`, `categories`, `schema_version`, `encrypted`, …). 400 for unknown categories, unknown `agent_ids`, or a missing passphrase with `env`; 404 when the nanoclaw central DB is missing.

**`GET /api/backup`** — `{ "backups": [metadata…] }`, newest first.

**`GET /api/backup/download/{backup_id}`** — streams the archive (`application/gzip`). 404 for unknown/invalid ids.

**`POST /api/backup/plan`** — body `{ "backup_id": str }`. Computes a conflict plan against the current target: per-item `action` ∈ `create | skip | overwrite | replace` with a reason, plus a summary (`full_restore`, counts, `schema_version`). 404 for unknown backup; 422 for a missing/invalid `backup_id`; 400 for an unsafe archive.

**`POST /api/backup/restore-script`** — body `{ "backup_id": str }`. Returns `{ "backup_id", "script_path", "script" }` — the host-side restore script (already written next to the archive at creation). Run it on the nanoclaw host: `bash backups/<id>.sh plan|restore|import [--yes] [--overwrite] [--passphrase …]`. `restore` requires a full-system backup (contains `data/v2.db`); use `import` for partial category backups.

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
- **Idempotency**: all endpoints are read-only except `POST /api/backup`, which writes an archive + restore script into the backup folder. No other state-mutating routes exist.
- **Schema source of truth**: `backend/app/telemetry/models.py` (Pydantic models). Frontend mirrors it in `frontend/src/lib/types.ts`. Bump `schema_version` on breaking changes.
- **Config**: all settings via env vars prefixed `NANOCLAW_` (see `backend/app/config.py` and `.env.example`).