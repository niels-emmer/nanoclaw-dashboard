# Third-Party Ledger

Record every external dependency here with license info and notes on local modifications.

| Component | Version/Commit | License | Purpose | Local Changes |
|-----------|----------------|---------|---------|---------------|
| FastAPI | 0.162.0 | MIT | Backend HTTP/WebSocket framework | None |
| Uvicorn | 0.54.0 | BSD-3-Clause | ASGI server for FastAPI app + dev reload | None |
| pydantic-settings | 2.16.2 | MIT | Environment-driven configuration | None |
| orjson | 3.13.0 | Apache-2.0 / MIT | High-performance JSON serialization | None |
| structlog | 26.1.0 | Apache-2.0 / MIT | Structured JSON logging | None |
| python-dotenv | 1.2.4 | BSD-3-Clause | Parse .env files | None |
| pytest | 9.2.0 | MIT | Backend test framework | None |
| httpx | 0.28.1 | BSD-3-Clause | Async HTTP client for tests | None |
| pytest-asyncio | 1.4.1.post1 | Apache-2.0 | Asyncio support for pytest | None |
| React / React DOM | 19.3.1 | MIT | Frontend UI library | None |
| Vite | 8.3.4 | MIT | Frontend dev server / build tool | None |
| Tailwind CSS | 4.3.3 | MIT | Utility-first CSS framework for styling | None |
| @tailwindcss/vite | 4.3.3 | MIT | Tailwind Vite integration plugin | None |
| lucide-react | 1.58.0 | ISC | SVG icon library for agent graph node icons | None |
| oxlint | 1.88.0 | MIT | JavaScript / TypeScript linter | None |
| TypeScript | 7.0.2 | Apache-2.0 | Static type checker | None |
| @types/node | 26.6.5 | MIT | Node.js type definitions for TypeScript | None |
| @types/react | 19.3.0 | MIT | React type definitions for TypeScript | None |
| @types/react-dom | 19.3.0 | MIT | React DOM type definitions for TypeScript | None |
| @vitejs/plugin-react | 6.1.2 | MIT | Vite React plugin for Fast Refresh | None |
| vitest | 5.0.5 | MIT | Frontend test runner | None |
| jsdom | 30.1.3 | MIT | DOM environment for component tests | None. The former 29.x pin is resolved: jsdom 30 requires undici ^8.12.1, which needs Node >= 22.19.0 (`markAsUncloneable`). The project pins Node 22.23.2 in CI, the security workflow, and the frontend Dockerfile, so the constraint is met. |
| undici | 8.12.4 | MIT | HTTP client used internally by jsdom (transitive) | None. Resolved via jsdom 30's `^8.12.1` range; the undici security fix is present in this 8.x line (Dependabot's 7.30.1 target is not installable alongside jsdom 30). |
| source-map-js | 1.2.2 | BSD-3-Clause | Source map consumer used by the Vite/PostCSS build pipeline (transitive) | None |
| @testing-library/react | 16.3.3 | MIT | React component testing utilities | None |
| @testing-library/jest-dom | 7.0.1 | MIT | DOM matchers for Vitest | None |
| Space Grotesk / IBM Plex Sans / JetBrains Mono | Google Fonts | Open Font License | Typography per design spec | Served via Google Fonts CDN |

Guidance:
- Add an entry the moment you introduce a dependency (backend or frontend).
- Cite authoritative source links (vendor docs, RFCs) when the dependency impacts security or protocol behavior.
- If you fork or patch a dependency, describe the delta and rationale.
