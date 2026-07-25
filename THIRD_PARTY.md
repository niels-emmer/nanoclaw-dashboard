# Third-Party Ledger

Record every external dependency here with license info and notes on local modifications.

| Component | Version/Commit | License | Purpose | Local Changes |
|-----------|----------------|---------|---------|---------------|
| FastAPI | 0.112.0 | MIT | Backend HTTP/WebSocket framework | None |
| Uvicorn | 0.30.3 | BSD | ASGI server for FastAPI app + dev reload | None |
| structlog | 24.2.0 | Apache-2.0 | Structured JSON logging | None |
| pydantic-settings | 2.4.0 | MIT | Environment-driven configuration | None |
| React | 19.2.7 | MIT | Frontend UI library | None |
| Vite | 8.1.5 | MIT | Frontend dev server/build tool | None |
| Space Grotesk / IBM Plex Sans / JetBrains Mono | Google Fonts | Open Font License | Typography per design spec | Served via Google Fonts CDN |

Guidance:
- Add an entry the moment you introduce a dependency (backend or frontend).
- Cite authoritative source links (vendor docs, RFCs) when the dependency impacts security or protocol behavior.
- If you fork or patch a dependency, describe the delta and rationale.
