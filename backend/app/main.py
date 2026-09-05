"""FastAPI application entrypoint."""

from __future__ import annotations

import asyncio
import ipaddress
from contextlib import asynccontextmanager, suppress
from typing import AsyncIterator, Optional
from urllib.parse import urlparse

from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect

from .config import settings
from .events import EventHub
from .logging import get_logger
from .telemetry.nanoclaw import NanoclawTelemetrySource
from .telemetry.source import MockTelemetrySource, TelemetrySource

log = get_logger(__name__)


def build_source() -> TelemetrySource:
    if settings.enabled:
        try:
            log.info("nanoclaw_source_enabled", root=str(settings.root_path))
            return NanoclawTelemetrySource(settings)
        except Exception as exc:  # noqa: BLE001
            log.warning("nanoclaw_source_fallback", error=str(exc))

    log.info("mock_source_active")
    return MockTelemetrySource(
        agent_names=settings.mock_agent_names,
        base_interval_ms=settings.base_interval_ms,
        jitter_ms=settings.jitter_ms,
    )


telemetry_source = build_source()
event_hub = EventHub(max_clients=settings.max_clients, buffer_size=settings.event_buffer_size)
_telemetry_task: Optional[asyncio.Task] = None


async def _run_telemetry_loop(source: TelemetrySource) -> None:
    async for event in source.stream():
        await event_hub.broadcast(event.model_dump())


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    global _telemetry_task
    log.info("starting_telemetry_loop")
    _telemetry_task = asyncio.create_task(_run_telemetry_loop(telemetry_source))
    try:
        yield
    finally:
        if _telemetry_task:
            _telemetry_task.cancel()
            with suppress(asyncio.CancelledError):
                await _telemetry_task
        log.info("telemetry_loop_stopped")


app = FastAPI(title=settings.app_name, lifespan=lifespan)


def is_allowed_origin(origin: str | None, host_header: str | None = None) -> bool:
    """Validate WebSocket origin while allowing loopback, mDNS (.local), and LAN private IPs."""
    if not origin:
        return True
    try:
        parsed = urlparse(origin)
        host = parsed.hostname
        if not host:
            return False

        if settings.allowed_origins:
            if origin in settings.allowed_origins or host in settings.allowed_origins:
                return True

        if host in ("localhost", "127.0.0.1", "::1", "0.0.0.0") or host.endswith(".local"):
            return True

        if host_header:
            req_host = host_header.split(":")[0]
            if host == req_host:
                return True

        try:
            ip = ipaddress.ip_address(host)
            if ip.is_private or ip.is_loopback or ip.is_link_local:
                return True
        except ValueError:
            pass

        return False
    except Exception:
        return False


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/config/file")
async def config_file(path: str, request: Request) -> dict:
    """Serve a single config file's content for the instance-details browser.

    The ``config_snapshot`` event carries the folder tree with metadata only;
    the frontend fetches file contents here on demand. Path traversal is
    rejected, only ``.md`` files under the nanoclaw root are served, and the
    origin is validated like the WebSocket endpoint.
    """
    if not is_allowed_origin(request.headers.get("origin"), request.headers.get("host")):
        raise HTTPException(status_code=403, detail="origin not allowed")
    if not path or path.startswith("/") or ".." in path.split("/"):
        raise HTTPException(status_code=404, detail="not found")

    if settings.enabled:
        root = settings.root_path.resolve()
        candidate = (root / path).resolve()
        if (
            not candidate.is_relative_to(root)
            or not candidate.is_file()
            or candidate.suffix != ".md"
        ):
            raise HTTPException(status_code=404, detail="not found")
        try:
            content = candidate.read_text(encoding="utf-8", errors="replace")[:20_000]
        except OSError:
            raise HTTPException(status_code=404, detail="not found")
        return {"path": path, "name": candidate.name, "content": content}

    # Mock mode: serve from the generated mock config groups.
    if isinstance(telemetry_source, MockTelemetrySource):
        for group in telemetry_source._build_mock_config_groups():
            for file in group["files"]:
                if file["path"] == path:
                    return file
    raise HTTPException(status_code=404, detail="not found")


@app.websocket("/ws/events")
async def events_socket(websocket: WebSocket) -> None:
    origin = websocket.headers.get("origin")
    host_header = websocket.headers.get("host")
    if not is_allowed_origin(origin, host_header):
        log.warning("websocket_origin_rejected", origin=origin)
        # Accept first so the 4003 close code is actually delivered to the client.
        await websocket.accept()
        await websocket.close(code=4003)
        return

    try:
        await event_hub.register(websocket)
    except RuntimeError:
        # Rejected (max clients reached); connection already closed with 4003.
        return
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        await event_hub.unregister(websocket)


_default_openapi = app.openapi


def _openapi_with_websocket() -> dict:
    """Default FastAPI schema plus the /ws/events WebSocket endpoint.

    FastAPI does not include WebSocket routes in OpenAPI, so the primary
    telemetry channel is documented here manually. Full protocol details
    live in API.md.
    """
    if app.openapi_schema:
        return app.openapi_schema
    schema = _default_openapi()
    schema.setdefault("paths", {})["/ws/events"] = {
        "get": {
            "summary": "WebSocket telemetry stream",
            "description": (
                "Streams canonical telemetry events (orchestrator -> agents -> "
                "sub-agents). On connect the server flushes buffered history, "
                "then streams live events. Rejected connections (disallowed "
                "origin or max clients reached) are accepted then closed with "
                "code 4003. See API.md for the full protocol."
            ),
            "responses": {
                "101": {
                    "description": (
                        "Switching Protocols (WebSocket upgrade). Rejected "
                        "connections are closed with code 4003."
                    )
                }
            },
            "x-websocket": True,
        }
    }
    return schema


app.openapi = _openapi_with_websocket
