---
name: github-workflow
description: Git workflow, branching strategy, commit discipline, and hygiene rules for the GitHub agent. Load before staging, committing, branching, or handing off work.
license: MIT
compatibility: opencode
---

## Branch naming

Work on feature branches. Never commit directly to main/master.

- `feature/<short-description>` — new features
- `fix/<short-description>` — bug fixes
- `chore/<short-description>` — tooling, deps, CI
- `docs/<short-description>` — documentation
- `release/<version>` — release branches (maintainers only)

## Before making any change

1. Confirm you are on the correct branch (`git branch`).
2. Pull latest from the base branch (`git pull origin main`).
3. Check for merge conflicts before touching files.

## Commit discipline

### Format

```
<type>(<scope>): <imperative-summary>

<body — wrap at 72 chars, explain WHY not what>

<footer — references, breaking changes>
```

### Types

| Type     | When to use                               |
|----------|-------------------------------------------|
| feat     | New feature for users/consumers           |
| fix      | Bug fix                                   |
| refactor | Code change with no behaviour change      |
| test     | Adding or updating tests only             |
| docs     | Documentation only                         |
| chore    | Build scripts, deps, tooling, CI           |
| perf     | Performance improvement                    |
| ci       | CI/CD pipeline changes only                |
| security | Security fix or hardening                  |

### Rules

- Summary: 50 chars max, imperative mood, no period.
- Body: explain WHY, not what (the diff shows what).
- Footer: reference issues/ADOs — e.g., `Refs: #42`, `Closes: #117`.
- Breaking changes: add `BREAKING CHANGE: <description>` in footer.
- One concern per commit. Never mix unrelated changes.

## What never goes in a commit

- Hardcoded secrets, API keys, tokens, passwords
- `.env` files or local config overrides
- Commented-out dead code (delete it)
- `console.log`, `print()`, `debugger` statements
- Generated build artifacts (`dist/`, `node_modules/`, `target/`, `build/`)
- Large binary files unless explicitly required
- Personal IDE/editor config (`.vscode/`, `.idea/`, `*.swp`)

## Staging discipline

- Use `git add -p` for precision — stage only relevant hunks.
- Do not stage unrelated changes in the same commit.
- Run `git diff --cached` before committing to verify staged content.
- Run linter/formatter before staging if one is configured.

## PR readiness checklist

Before opening a PR, confirm:

- [ ] Branch name follows conventions.
- [ ] Commits are atomic with clear messages.
- [ ] No secrets, debug artifacts, or generated files are staged.
- [ ] CI/lint passes locally if runnable.
- [ ] Tests pass or are added for the change.
- [ ] The diff contains only the intended changes.
- [ ] `.env.example` is updated if new env vars were added.
- [ ] Breaking changes are documented in commit footer.
