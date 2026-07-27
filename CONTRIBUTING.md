# Contributing to Nanoclaw Dashboard

Thanks for your interest! This document covers how to contribute, report
issues, and get your changes merged.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Questions & Discussions](#questions--discussions)
- [How to Contribute](#how-to-contribute)
- [Development Setup](#development-setup)
- [Coding Guidelines](#coding-guidelines)
- [Pull Request Process](#pull-request-process)
- [Governance Checklist](#governance-checklist)

## Code of Conduct

All contributors must follow our [Code of Conduct](./CODE_OF_CONDUCT.md).
Be respectful, constructive, and inclusive.

## Questions & Discussions

If you have a question or want to discuss an idea before implementing, open
a [Discussion] or join the community channels.

[Discussion]: https://github.com/niels-emmer/nanoclaw-dashboard/discussions

## How to Contribute

### Reporting Bugs

1. Check the [issue tracker] for existing reports.
2. If none exists, [open a bug report] and include:
   - Nanoclaw Dashboard version / commit hash
   - OS, Python version, Node version
   - Steps to reproduce (minimal if possible)
   - Expected vs. actual behavior
   - Logs or screenshots if relevant

### Suggesting Features

Open a [feature request] describing the problem you want to solve, why it
matters, and any design sketches you have.
[issue tracker]: https://github.com/niels-emmer/nanoclaw-dashboard/issues

[open a bug report]: https://github.com/niels-emmer/nanoclaw-dashboard/issues/new?template=bug_report.md
[feature request]: https://github.com/niels-emmer/nanoclaw-dashboard/issues/new?template=feature_request.md

## Development Setup

See the [README](./README.md#quick-start) for one-shot setup via
`scripts/install_dashboard.sh`.

### Prerequisites

- Python **3.11+**
- Node.js **20.19.0** (vendored automatically by the install script)
- A POSIX shell (macOS / Linux)

### Quick Start (Manual)

```bash
# Backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
cd backend && pytest && uvicorn app.main:app --reload --port 8000

# Frontend (in another terminal)
PATH=$PWD/.tools/node/bin:$PATH npm --prefix frontend install
PATH=$PWD/.tools/node/bin:$PATH npm --prefix frontend run dev
```

The frontend connects to `ws://localhost:8000/ws/events` by default.

### Docker

```bash
docker compose up --build
```

## Coding Guidelines

### Backend (Python / FastAPI)

- Follow PEP 8. Use descriptive names.
- Type-annotate all function signatures and dataclass fields.
- Write `pytest` tests that cover new routes, telemetry sources, or
  schema changes. Run with `cd backend && pytest`.
- Log with structlog (JSON). Don't use `print()`.
- Pin exact versions in `requirements.txt`. Update `THIRD_PARTY.md`.

### Frontend (TypeScript / React)

- Use TypeScript `strict` mode. Avoid `any` unless absolutely necessary.
- New components must match the existing patterns in `src/components/`.
- Extend `useEventStream` hook for WebSocket state — don't reimplement
  connection/retry logic elsewhere.
- Run `npm run lint` (oxlint) before committing. Run `npm run build` to
  type-check and bundle.
- Update `src/lib/types.ts` when the backend telemetry schema changes.
- Keep color and typography tokens in `src/index.css` / `App.css`.

### Both

- **No secrets in code or commits.** Use environment variables.
- Keep docs in sync: `README.md`, `docs/ARCHITECTURE.md`, `SECURITY.md`,
  `THIRD_PARTY.md`, `docs/DECISIONS.md`.
- Prefer small, focused commits over large ones.

## Pull Request Process

1. **Fork** the repository and create a feature branch from `main`.
2. **Make your changes**, following the guidelines above.
3. **Run all checks** locally:
   ```bash
   cd backend && pytest
   PATH=$PWD/.tools/node/bin:$PATH && cd frontend && npm run lint && npm run build
   ```
4. **Open a pull request** against `main`. Use the PR template and fill it
   out. Link any related issues.
5. **A maintainer reviews** your PR. Expect discussion and maybe requests
   for changes.
6. **Merge** after approval. We use squash-merge to keep history clean.

### PR Title Convention

Use conventional commits:

- `feat:` — new feature
- `fix:` — bug fix
- `docs:` — documentation
- `refactor:` — code change that neither fixes nor adds
- `chore:` — tooling, CI, dependencies

Example: `feat: add telemetry source for agent lifecycle events`

## Governance Checklist

Before merging any PR, verify:

- [ ] Threat model updated if a new network surface or data store was added
- [ ] `docs/DECISIONS.md` updated (new ADR entry if schema, transport, or deps changed)
- [ ] `THIRD_PARTY.md` updated if dependencies added / removed
- [ ] `README.md`, `docs/ARCHITECTURE.md` reflect any new commands or workflows
- [ ] `AGENTS.md` checklist items addressed
- [ ] Backend tests pass (`cd backend && pytest`)
- [ ] Frontend builds cleanly (`cd frontend && npm run build`)
- [ ] No secrets committed
