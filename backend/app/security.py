"""Shared request-security helpers (origin validation for HTTP/WS endpoints)."""

from __future__ import annotations

import ipaddress
from urllib.parse import urlparse

from .config import settings


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