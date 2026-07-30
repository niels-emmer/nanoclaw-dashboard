# Third-Party Ledger

Record every external dependency here with license info and notes on local modifications.

| Component | Version/Commit | License | Purpose | Local Changes |
|-----------|----------------|---------|---------|---------------|
| FastAPI | 0.140.0 | MIT | Backend HTTP/WebSocket framework | None |
| Uvicorn | 0.51.0 | BSD-3-Clause | ASGI server for FastAPI app + dev reload | None |
| pydantic-settings | 2.14.2 | MIT | Environment-driven configuration | None |
| orjson | 3.11.9 | Apache-2.0 / MIT | High-performance JSON serialization | None |
| structlog | 26.1.0 | Apache-2.0 / MIT | Structured JSON logging | None |
| python-dotenv | 1.2.2 | BSD-3-Clause | Parse .env files | None |
| pytest | 9.1.1 | MIT | Backend test framework | None |
| httpx | 0.28.1 | BSD-3-Clause | Async HTTP client for tests | None |
| pytest-asyncio | 1.4.0 | Apache-2.0 | Asyncio support for pytest | None |
| React / React DOM | 19.2.8 | MIT | Frontend UI library | None |
| Vite | 8.1.5 | MIT | Frontend dev server / build tool | None |
| Tailwind CSS | 4.3.3 | MIT | Utility-first CSS framework for styling | None |
| @heroui/react | 3.2.2 | Apache-2.0 | UI component library | None |
| @heroui/styles | 3.2.2 | Apache-2.0 | HeroUI pre-built component styles | None |
| @tailwindcss/vite | 4.3.3 | MIT | Tailwind Vite integration plugin | None |
| lucide-react | 1.27.0 | MIT | SVG icon library for agent graph node icons | None |
| oxlint | 1.75.0 | MIT | JavaScript / TypeScript linter | None |
| TypeScript | 7.0.2 | Apache-2.0 | Static type checker | None |
| Space Grotesk / IBM Plex Sans / JetBrains Mono | Google Fonts | Open Font License | Typography per design spec | Served via Google Fonts CDN |

Guidance:
- Add an entry the moment you introduce a dependency (backend or frontend).
- Cite authoritative source links (vendor docs, RFCs) when the dependency impacts security or protocol behavior.
- If you fork or patch a dependency, describe the delta and rationale.
