---
name: test-patterns
description: Test design principles, coverage targets, edge cases, and mocking rules. Load before writing tests.
license: MIT
compatibility: opencode
---

## Framework & structure

- Identify the framework: `pytest` for Python backend, Vitest + React Testing Library for frontend.
- Mirror the source tree: `backend/tests/` mirrors `backend/app/`, one test file per source module.
- Name test files after the module they test: `test_<module>.py` or `<module>.test.ts`.
- Place shared fixtures and conftest in `backend/tests/conftest.py` or `frontend/src/test/`.

## Coverage targets

- **Line coverage**: minimum 80% for new code, 90% for critical paths (auth, data access, WebSocket handling).
- **Branch coverage**: exercise both true/false paths for every conditional.
- **No coverage drops**: new code must not reduce overall project coverage.
- Run coverage reports with `pytest --cov=app` (backend) or `vitest --coverage` (frontend).

## What to test

Every test suite must cover these three categories:

### Happy path
- The primary success flow: valid input → expected output.
- Normal state transitions (e.g., agent idle → running → completed).
- Typical payload sizes and shapes.

### Error paths
- Invalid input: missing fields, wrong types, out-of-range values.
- Failed dependencies: database unreachable, WebSocket disconnected, file not found.
- Authorization failures: unauthenticated request, insufficient permissions.
- Timeouts and cancellations: operation exceeds deadline, client disconnects mid-stream.

### Edge cases
- Empty collections: `[]`, `{}`, `""`, `None`/`null`.
- Boundary values: max/min integers, max string length, max array size.
- Concurrent access: two clients connecting/disconnecting simultaneously.
- Duplicate events: same event ID received twice (idempotency).
- Stale data: events with old timestamps, expired sessions, removed agents.

## Mocking rules

- Mock at the boundary: mock external services (databases, APIs, filesystem), not internal logic.
- Use `unittest.mock` (Python) or `vi.mock` (Vitest) — prefer built-in mocking over third-party libs.
- Never mock what you don't own: prefer real instances of project-internal classes unless they have expensive side effects.
- Integration tests (marked with `@pytest.mark.integration`) may call real Nanoclaw databases or WebSocket endpoints — these are excluded from CI and run manually.
- Assert that mocks were called with expected arguments (`assert_called_once_with` / `toHaveBeenCalledWith`).
- Clean up mocks in teardown to avoid cross-test contamination.

## Test organization

```
backend/tests/
├── conftest.py              # Shared fixtures (app client, event hub, mock source)
├── test_app.py              # Route-level tests (health, WebSocket, CORS)
├── test_telemetry.py        # Mock source event generation
└── test_schema_contract.py  # Schema version and type alignment

frontend/src/
└── __tests__/
    ├── components/          # Per-component tests (FlowCanvas, AgentGrid, EventFeed)
    ├── hooks/               # useEventStream tests with mocked WebSocket
    └── lib/                 # Utility and type tests
```

## Async testing (backend)

- Use `pytest-asyncio` with `@pytest.mark.asyncio` for async test functions.
- Use `AsyncMock` for async dependencies.
- Set `asyncio_mode = "strict"` in `pyproject.toml` to catch missing marks.
- Use `httpx.AsyncClient` with the FastAPI app for WebSocket and HTTP endpoint tests.

## Frontend testing

- Use `render()` from React Testing Library for component rendering.
- Use `fireEvent` / `userEvent` for simulating user interactions.
- Wrap components in necessary providers (ThemeProvider, etc.) via a custom `render` wrapper.
- Test WebSocket integration by mocking the WebSocket constructor and simulating `onmessage` events.
- Assert on visible DOM output, not internal state — prefer `screen.getByText()` / `screen.getByRole()`.
