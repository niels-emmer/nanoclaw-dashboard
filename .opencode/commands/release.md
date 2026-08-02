---
description: Interactive release workflow — prompts for version and commit title, then handles changelog, tagging, and push. The release.yml workflow auto-creates the GitHub release on tag push.
agent: orchestrator
---

# /release — Automated Release Workflow

Execute the full release flow interactively. Follow these steps in order.

## 1. Load the release-engineering skill

Load the `release-engineering` skill to get semver rules and the release process reference.

## 2. Determine the next version

Read the latest tag from git: `git tag -l 'v*' --sort=-v:refname | head -1`

Parse the current version and suggest the next MINOR bump (since releases are feature additions). Present the user with:

> **Suggested version**: v{NEXT_MINOR}
> Press Enter to accept, or type a different version (e.g., v{Major}.{Minor}.{Patch}):

If the user provides a version, validate it matches `vMAJOR.MINOR.PATCH` format. Re-prompt if invalid.

## 3. Ask for a commit title

Suggest a default commit title and let the user accept or override:

> **Commit title**: docs: update CHANGELOG for v{X.Y.Z}
> Press Enter to accept, or type a different title:

## 4. Verify main is green

Run both verification gates:

```bash
cd backend && pytest
cd ../frontend && npm run build
```

If either fails, report the failure and abort — do not proceed with the release.

## 5. Update CHANGELOG.md

Read the current `CHANGELOG.md` and the git log since the last release tag:

```bash
git log --oneline --format="%h %s" {LAST_TAG}..HEAD
```

Categorize commits by their conventional commit prefix:

| Prefix | CHANGELOG section |
|--------|-------------------|
| `feat:` or `feat(` | **Added** |
| `fix:` or `fix(` | **Fixed** |
| `refactor:` or `refactor(` | **Changed** |
| `chore:` or `chore(` | **Chores** |
| `docs:` or `docs(` | **Documentation** |
| `perf:` or `perf(` | **Changed** |
| `security:` or `security(` | **Security** |
| `ci:` or `ci(` | **Chores** |
| `test:` or `test(` | **Chores** |

For each commit, extract a human-readable description from the commit message (strip the prefix, capitalize the first letter, keep the commit SHA in parentheses with `#` prefix).

Insert a new version section at the top of the changelog (after the `# Changelog` heading) with today's date in ISO format (`date +%Y-%m-%d`). Format:

```markdown
## [{VERSION}] — {DATE}

### Added

- {description}. (#{sha})

### Changed

- {description}. (#{sha})

### Fixed

- {description}. (#{sha})

### Chores

- {description}. (#{sha})

### Documentation

- {description}. (#{sha})
```

Add a version reference link at the bottom of the file:
```markdown
[{VERSION}]: https://github.com/niels-emmer/nanoclaw-dashboard/releases/tag/v{VERSION}
```

## 6. Commit and push

```bash
git add CHANGELOG.md
git commit -m "{COMMIT_TITLE}"
git push
```

## 7. Create and push the tag

```bash
git tag -a v{VERSION} -m "Release v{VERSION}"
git push origin v{VERSION}
```

The `.github/workflows/release.yml` workflow will automatically create the GitHub Release when the tag is pushed.

## 8. Confirm

Report the release URL: `https://github.com/niels-emmer/nanoclaw-dashboard/releases/tag/v{VERSION}`

## Error handling

- If `pytest` or `npm run build` fails: abort, show the failure output, and tell the user to fix the issue before retrying `/release`.
- If the tag already exists: abort and tell the user the version has already been released.
- If there are uncommitted changes other than CHANGELOG.md: warn the user and ask whether to proceed or abort.
