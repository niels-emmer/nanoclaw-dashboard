# Third-Party Ledger

Record every external dependency here with license info and notes on local modifications.

| Component | Version/Commit | License | Purpose | Local Changes |
|-----------|----------------|---------|---------|---------------|
| FastAPI | 0.140.0 | MIT | Backend HTTP/WebSocket framework | None |
| Uvicorn | 0.51.0 | BSD | ASGI server for FastAPI app + dev reload | None |
| structlog | 26.1.0 | Apache-2.0 | Structured JSON logging | None |
| pydantic-settings | 2.14.2 | MIT | Environment-driven configuration | None |
| React | 19.2.7 | MIT | Frontend UI library | None |
| Vite | 8.1.5 | MIT | Frontend dev server/build tool | None |
| Tailwind CSS | 4.x | MIT | Utility-first CSS framework for styling | None |
| @heroui/react | 3.x | Apache-2.0 | UI component library (Card, Chip, Typography) | None |
| @heroui/styles | 3.x | Apache-2.0 | HeroUI pre-built component styles | None |
| @tailwindcss/vite | 4.x | MIT | Tailwind Vite integration plugin | None |
| Space Grotesk / IBM Plex Sans / JetBrains Mono | Google Fonts | Open Font License | Typography per design spec | Served via Google Fonts CDN |

Guidance:
- Add an entry the moment you introduce a dependency (backend or frontend).
- Cite authoritative source links (vendor docs, RFCs) when the dependency impacts security or protocol behavior.
- If you fork or patch a dependency, describe the delta and rationale.
