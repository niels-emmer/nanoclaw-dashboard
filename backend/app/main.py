"""FastAPI application entrypoint."""

from __future__ import annotations

import asyncio
import ipaddress
from contextlib import asynccontextmanager, suppress
from typing import AsyncIterator, Optional
from urllib.parse import urlparse

from fastapi import FastAPI, WebSocket, WebSocketDisconnect

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


@app.websocket("/ws/events")
async def events_socket(websocket: WebSocket) -> None:
    origin = websocket.headers.get("origin")
    host_header = websocket.headers.get("host")
    if not is_allowed_origin(origin, host_header):
        log.warning("websocket_origin_rejected", origin=origin)
        await websocket.close(code=4003)
        return

    await event_hub.register(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        await event_hub.unregister(websocket)
