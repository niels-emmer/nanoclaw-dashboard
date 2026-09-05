import asyncio

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.events import EventHub
from app.main import app, is_allowed_origin


def test_health_endpoint():
    client = TestClient(app)
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_openapi_includes_websocket_endpoint():
    client = TestClient(app)
    spec = client.get("/openapi.json").json()
    ws_path = spec["paths"]["/ws/events"]
    assert "get" in ws_path
    assert "101" in ws_path["get"]["responses"]
    assert ws_path["get"].get("x-websocket") is True


def test_websocket_rejects_disallowed_origin_with_4003():
    client = TestClient(app)
    with pytest.raises(WebSocketDisconnect) as exc_info:
        with client.websocket_connect("/ws/events", headers={"origin": "http://evil.com"}) as ws:
            ws.receive_text()
    assert exc_info.value.code == 4003


class _FakeWebSocket:
    def __init__(self) -> None:
        self.accepted = False
        self.closed_code: int | None = None

    async def accept(self) -> None:
        self.accepted = True

    async def close(self, code: int | None = None) -> None:
        self.closed_code = code

    async def send_json(self, payload: object) -> None:
        pass


def test_register_rejects_excess_clients_with_4003():
    hub = EventHub(max_clients=1, buffer_size=0)
    first = _FakeWebSocket()
    asyncio.run(hub.register(first))
    assert first.accepted is True

    second = _FakeWebSocket()
    with pytest.raises(RuntimeError):
        asyncio.run(hub.register(second))
    assert second.accepted is True
    assert second.closed_code == 4003


def test_is_allowed_origin_lan_and_loopback():
    assert is_allowed_origin(None) is True
    assert is_allowed_origin("http://localhost:5173") is True
    assert is_allowed_origin("http://127.0.0.1:8000") is True
    assert is_allowed_origin("http://192.168.1.50:4173") is True
    assert is_allowed_origin("http://10.0.0.12:8000") is True
    assert is_allowed_origin("http://172.16.5.4:4173") is True
    assert is_allowed_origin("http://myhost.local:8000") is True


def test_is_allowed_origin_rejects_external():
    assert is_allowed_origin("http://evil.com") is False
    assert is_allowed_origin("http://malicious-domain.net:8000") is False


def test_config_file_endpoint_serves_mock_file():
    """The config file endpoint serves mock config content in mock mode."""
    client = TestClient(app)
    resp = client.get("/api/config/file", params={"path": "agents/coder.md"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["path"] == "agents/coder.md"
    assert body["name"] == "coder.md"
    assert "Coder" in body["content"]


def test_config_file_endpoint_rejects_path_traversal():
    client = TestClient(app)
    assert client.get("/api/config/file", params={"path": "../../etc/passwd"}).status_code == 404
    assert client.get("/api/config/file", params={"path": "agents/../secret.md"}).status_code == 404


def test_config_file_endpoint_rejects_absolute_and_missing():
    client = TestClient(app)
    assert client.get("/api/config/file", params={"path": "/etc/passwd"}).status_code == 404
    assert client.get("/api/config/file", params={"path": "does-not-exist.md"}).status_code == 404


def test_config_file_endpoint_rejects_disallowed_origin():
    client = TestClient(app)
    resp = client.get(
        "/api/config/file",
        params={"path": "agents/coder.md"},
        headers={"origin": "http://evil.com"},
    )
    assert resp.status_code == 403

