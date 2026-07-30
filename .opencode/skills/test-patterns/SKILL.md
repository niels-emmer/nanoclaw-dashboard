---
name: test-patterns
description: Test design principles, coverage targets, edge cases, and mocking rules. Load before writing tests.
license: MIT
compatibility: opencode
---

## Rules

1. Identify framework (`pytest` for Python backend, Vitest/React Testing Library for frontend).
2. Mirror existing test structure (`backend/tests/`).
3. Cover happy path, error paths, and edge inputs.
4. Mocks must not call live external services or real Nanoclaw databases unless in integration mode.
