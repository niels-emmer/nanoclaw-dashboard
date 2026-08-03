# Nanoclaw Dashboard Agent Instructions

## ⚠️ MANDATORY STARTUP — Execute immediately, before any user response

**Do not skip these. Do not defer them. Do not answer the user until both are done.**

Run `/start` — this loads the governance skill, reads the workflow playbook, and classifies the data.

If `/start` is unavailable (e.g., command not yet registered), fall back to the manual sequence:
1. **Ask the user for task type and description**, then agree on a branch name.
2. **Load the `governance` skill** — call `skill` with name `governance`
3. **Read `docs/OPENCODE_WORKFLOW.md`** — call `read` on that file
4. **Classify the data** — determine sensitivity level (default INTERNAL)
5. **Create the branch** — `git checkout -b <branch-name>`

These steps are not optional. They are the first thing you do in every session, regardless of what the user asks. Only after all steps are complete may you respond.

---

## Config architecture: global vs repo split

OpenCode configs **merge** — global and repo settings combine, with repo overriding on collision.

**Global (`~/.config/opencode/`)** provides the universal layer:
- 16 coding rules in `AGENTS.md`
- Generic agents: `@explorer`, `@github`, `@reviewer`, `@security-auditor`
- Universal skills: `code-standards`, `test-patterns`, `security-checklist`, `github-workflow`, `github-security`, `pr-standards`, `release-engineering`
- Generic commands: `/plan`, `/handoff`

**This repo (`.opencode/`)** provides project-specific overrides:
- `@orchestrator` — primary agent with project subagents and workflow
- `@general`, `@scout`, `@docs` — project-specific subagents
- `/start`, `/release`, `/decision-log` — commands that reference project files
- `governance` skill — modified to reference `docs/decision-log.md`
- `opencode.json` — model pinning, subagent depth, instructions
