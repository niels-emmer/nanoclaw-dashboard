"""FastAPI application entrypoint."""

from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager, suppress
from typing import AsyncIterator, Optional

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
event_hub = EventHub(max_clients=settings.max_clients)
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


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.websocket("/ws/events")
async def events_socket(websocket: WebSocket) -> None:
    await event_hub.register(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        await event_hub.unregister(websocket)
