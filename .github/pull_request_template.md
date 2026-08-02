---
name: Pull Request
about: Submit changes to Nanoclaw Dashboard
title: ''
labels: ''
assignees: ''
---

## Description

Briefly describe what this PR does and why.

Closes #(issue-number)

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Refactor / chore
- [ ] Dependency update

## Governance Checklist

- [ ] `docs/decision-log.md` updated (if schema, transport, or architecture changed)
- [ ] `THIRD_PARTY.md` updated (if dependencies added / removed)
- [ ] `README.md` / `docs/ARCHITECTURE.md` updated (if commands or workflows changed)
- [ ] Threat model updated or reviewed (if network surface / data store changed)
- [ ] `AGENTS.md` checklist items addressed

## Verification

- [ ] Backend tests pass: `cd backend && pytest`
- [ ] Frontend build succeeds: `cd frontend && npm run build`
- [ ] Frontend lint passes: `cd frontend && npm run lint`
- [ ] No secrets committed
