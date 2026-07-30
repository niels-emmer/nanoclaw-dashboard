---
name: pr-standards
description: Pull request creation, review, and merging standards. Covers PR description format, review depth, merge strategies, and gate checks. Load before reviewing or creating PRs.
license: MIT
compatibility: opencode
---

## PR description template

```markdown
## Summary
<!-- One paragraph: what changed and why. -->

## Related issues
<!-- Closes: #N, Refs: #M -->

## Type of change
- [ ] feat (new feature)
- [ ] fix (bug fix)
- [ ] refactor (no behaviour change)
- [ ] test (tests only)
- [ ] docs (documentation)
- [ ] chore (tooling, deps, CI)
- [ ] security (security hardening)

## Testing
<!-- How was this tested? Commands run, manual steps, edge cases checked. -->

## Checklist
- [ ] Self-review completed
- [ ] No new warnings
- [ ] Tests pass / added
- [ ] Documentation updated (if needed)
- [ ] Breaking changes called out in commit footer
```

## Review depth

For every PR review, check:
- **Correctness**: Does the code do what it claims?
- **Security**: Any secrets, unvalidated input, or vulnerable dependencies?
- **Maintainability**: Readability, simplicity, no duplicate code.
- **Architecture**: Consistency with established project patterns.
- **CI/CD gates**: Are required CI checks passing?
