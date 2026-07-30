"""Connection hub for broadcasting telemetry events."""

from __future__ import annotations

import asyncio
from collections import deque
from typing import Any

from fastapi import WebSocket

from .logging import get_logger


class EventHub:
    def __init__(self, max_clients: int = 50, buffer_size: int = 100) -> None:
        self._clients: set[WebSocket] = set()
        self._lock = asyncio.Lock()
        self._max = max_clients
        self._buffer: deque[Any] = deque(maxlen=buffer_size)
        self._log = get_logger(__name__)

    async def register(self, websocket: WebSocket) -> None:
        async with self._lock:
            if len(self._clients) >= self._max:
                await websocket.close(code=4003)
                raise RuntimeError("too many clients connected")
            await websocket.accept()
            # Flush buffered history to the new client before live events
            for payload in self._buffer:
                try:
                    await websocket.send_json(payload)
                except Exception as exc:  # noqa: BLE001
                    self._log.warning("history_flush_failed", error=str(exc))
                    break
            self._clients.add(websocket)
            self._log.info("client_connected", clients=len(self._clients), history_flushed=len(self._buffer))

    async def unregister(self, websocket: WebSocket) -> None:
        async with self._lock:
            if websocket in self._clients:
                self._clients.remove(websocket)
                self._log.info("client_disconnected", clients=len(self._clients))

    async def broadcast(self, payload: Any) -> None:
        self._buffer.append(payload)
        dead: list[WebSocket] = []
        for ws in list(self._clients):
            try:
                await ws.send_json(payload)
            except Exception as exc:  # noqa: BLE001
                self._log.warning("client_send_failed", error=str(exc))
                dead.append(ws)
        for ws in dead:
            await self.unregister(ws)
