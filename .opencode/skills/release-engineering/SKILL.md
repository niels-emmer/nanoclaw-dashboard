---
name: release-engineering
description: Semantic versioning, changelog generation, release creation, and hotfix management for the GitHub agent. Load before creating, documenting, or cutting a release.
license: MIT
compatibility: opencode
---

## Semantic versioning

Given a version `MAJOR.MINOR.PATCH`:
- **MAJOR**: Breaking API or behaviour change
- **MINOR**: New feature, backward-compatible
- **PATCH**: Bug fix, backward-compatible

## Release process

1. Confirm `main` is green (`pytest` and `npm run build`).
2. Update `CHANGELOG.md`.
3. Create release tag: `git tag -a vMAJOR.MINOR.PATCH -m "Release vMAJOR.MINOR.PATCH"`.
4. Create GitHub release via `gh release create`.
