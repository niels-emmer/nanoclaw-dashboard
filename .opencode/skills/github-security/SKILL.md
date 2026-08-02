---
name: github-security
description: GitHub-specific security checklist for secrets management, branch protection, access control, and supply-chain hardening.
license: MIT
compatibility: opencode
---

## Secrets management

- [ ] No secrets committed in git history — run `trufflehog` or `gitleaks` on the full history if unsure.
- [ ] `.env` files are in `.gitignore` and never staged.
- [ ] GitHub Actions secrets and variables are used for all credentials — never hardcoded in workflow files.
- [ ] Deploy keys are scoped to a single repository and rotated periodically.
- [ ] If a secret was ever committed, assume it is compromised and rotate it immediately.

## Branch protection

- [ ] Branch protection rules configured on `main`:
  - [ ] Require pull request before merging.
  - [ ] Require status checks to pass before merging (CI, lint, security).
  - [ ] Require up-to-date branches (stale reviews are dismissed).
  - [ ] Require signed commits.
  - [ ] Require linear history (no merge commits).
  - [ ] Do not allow force pushes.
  - [ ] Do not allow deletions.
- [ ] `CODEOWNERS` file exists and enforces review for sensitive paths (workflows, config, deps).

## Access control

- [ ] Repository is private unless explicitly intended to be public.
- [ ] Collaborator roles follow least privilege: read-only for most, triage for issue triagers, write for active contributors, maintain/admin for leads only.
- [ ] Outside collaborator access is reviewed quarterly.
- [ ] No personal access tokens (PATs) with repo scope are stored in plaintext.

## Supply-chain hardening

- [ ] Dependabot enabled for automated dependency security alerts (npm + pip).
- [ ] Dependabot is configured for weekly checks with open-pull-requests-limit set.
- [ ] GitHub Actions dependencies pinned to commit hashes (not version tags) — e.g., `actions/checkout@11bd719...` not `actions/checkout@v4`.
- [ ] `npm audit --audit-level=high` and `pip-audit` run in CI on every PR.
- [ ] No unverified third-party Actions from outside the GitHub Marketplace.
- [ ] `package-lock.json` and `requirements.txt` are committed and kept up to date.

## Incident response

- [ ] If a secret leak is detected: rotate the credential, revoke the exposed token, audit access logs, and document in a security advisory.
- [ ] If a vulnerable dependency is reported: assess impact (CRITICAL/HIGH within 24h, MEDIUM within 7d), update or mitigate, and verify via CI.
