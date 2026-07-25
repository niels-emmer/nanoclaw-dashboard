# Security Plan

The repository follows `agent-governance/GOVERNANCE.md`. This document captures repo-specific actions for each requirement.

## Threat Modeling
- STRIDE analysis for the current WebSocket surface lives in `docs/threat-models/2026-07-25.md` (covers asset inventory, trust boundaries, and mitigations for spoofed clients / data poisoning / DoS).
- Model every new interface (additional routes, SSE, persistence) and link the artifact into `DECISIONS.md`.
- Key assets today: orchestrator telemetry stream, agent roster derived in-browser, WebSocket transport, deployment host.

## Input + Transport Handling
- Treat nanoclaw telemetry and WebSocket clients as untrusted.
- Validation happens at the `TelemetryEvent` model boundary; malformed payloads never reach connected clients.
- `EventHub` enforces `max_clients` (default 50) to provide coarse backpressure; fine-grained per-IP throttling is a TODO before internet exposure.
- Frontend renders payloads via React, which escapes HTML by default; keep summaries text-only and avoid `dangerouslySetInnerHTML` unless sanitized.
- When the real nanoclaw feed replaces the mock, re-run the threat model to cover authentication, replay protection, and data provenance.

## Secrets + Configuration
- No secrets committed. Use `.env.example` for documentation only; real secrets supplied via environment variables or OS keychain.
- Backend configuration loaded via Pydantic `BaseSettings`; avoid environment-specific branches.

## Cryptography
- Use only standard libraries (Python `cryptography`, `ssl` module) when TLS or signing is required.
- Rely on platform TLS termination if behind a proxy; otherwise configure uvicorn + certs explicitly.

## Dependencies + Provenance
- Pin Python and frontend dependencies (exact versions) + commit lockfiles (`poetry.lock`, `package-lock.json`/`pnpm-lock.yaml`).
- Run automated CVE scanning (e.g., `pip-audit`, `npm audit`) in CI; document risk acceptance in `DECISIONS.md` if needed.
- Generate SBOM (Syft or similar) for each release artifact and archive it.

## Logging + Monitoring
- Backend logs use structlog JSON. Bind correlation IDs if you add multi-request workflows.
- Frontend exposes an opt-in debug panel (button toggle). Disable it for production builds if sensitive data will traverse the UI.

## Testing Expectations
- Unit tests cover schema validation + telemetry sequencing; extend coverage to connection limits once rate limiting lands.
- Add integration/e2e suites (Playwright or Cypress) before shipping widely to ensure rendering + reconnection logic cannot regress silently.

## Incident Response Stubs
- Capture known issues + mitigations in `SECURITY.md` once the system is live.
- Document contact path for operational incidents in README when production workflow is defined.
- Until auth is added, deploy behind a VPN or trusted network segment; the stream is currently unauthenticated and should not be internet-exposed.
