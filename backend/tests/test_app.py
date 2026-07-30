from fastapi.testclient import TestClient

from app.main import app, is_allowed_origin


def test_health_endpoint():
    client = TestClient(app)
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


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

