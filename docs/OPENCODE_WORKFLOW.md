# OpenCode Workflow & Governance Playbook

_Last reviewed: 2026-08-03_ (updated: `/start` now interactive — prompts for task type, description, and branch name)

This document consolidates the OpenCode reference docs that apply to the Nanoclaw dashboard repository. Every OpenCode session **must** follow these rules in addition to the repo-root `AGENTS.md` instructions. When guidance conflicts, the stricter rule wins.

## Source references

- [Agents](https://opencode.ai/docs/agents/) — agent types, permissions, task delegation.
- [Tools](https://opencode.ai/docs/tools/) — built-in tool surface and defaults.
- [Permissions](https://opencode.ai/docs/permissions/) — allow/ask/deny semantics, wildcards, and external directory rules.
- [Rules](https://opencode.ai/docs/rules/) — how `AGENTS.md`, instructions, and precedence work.
- [Models](https://opencode.ai/docs/models/) — provider/model selection, variants, defaults.
- [Config](https://opencode.ai/docs/config/) — config precedence, `subagent_depth`, instructions, sharing, and managed settings.
- [Enterprise](https://opencode.ai/docs/enterprise/) — governance expectations (data residency, sharing, centralized config, SSO).

## Mandatory workflow for OpenCode sessions

1. **Run `/start`** — this loads the governance skill, reads this playbook, classifies the data, and creates a branch. It is the single command that replaces the manual startup ritual. (See [The `/start` command](#the-start-command) below.)
2. **Plan before non-trivial edits** — use `/plan` (Plan agent) whenever a task spans multiple files or requires more than one command. (Agents doc)
3. **Delegate intentionally** — prefer the orchestrator primary agent for coordination, `@explorer` for read-only discovery, `@github` for CLI-driven repository/PR work, `@general` for multi-step research and implementation tasks, `@scout` for external dependency research (licenses, CVEs), `@reviewer` for regression and risk review, `@security-auditor` for security gates, and `@docs` for documentation audits. (Agents doc)
4. **Enforce tool/permission approvals** — follow the ask/allow/deny grid defined in `.opencode/agents/*.md`. Never bypass user confirmation for denied or ask-marked operations even if auto-approve is enabled. (Tools + Permissions docs)
5. **Verify before completion** — run the narrowest meaningful check (tests, linters, `gh` status) before reporting success. (Rules doc > Verify Before Done)
6. **Document the session** — update todos, ADRs, and DECISIONS when behavior changes. Record AI-authored work in `/handoff`. (Rules + repo governance section)

## The `/start` command

`/start` is the single command that replaces the manual startup ritual. It is the **first thing you run** in every new OpenCode session on this project.

### What it does

1. **Prompts for task type** — asks the user to choose from: `feature`, `fix`, `chore`, `docs`, `refactor`, `test`.
2. **Prompts for description** — asks for a short (2-6 word) description of the task.
3. **Suggests a branch name** — generates `<type>/<kebab-case-description>` and asks the user to accept or edit it.
4. **Loads the `governance` skill** — injects data classification rules, audit trail requirements, and dependency compliance gates.
5. **Reads this playbook** (`docs/OPENCODE_WORKFLOW.md`) — ensures every agent knows the workflow, governance, and enforcement rules.
6. **Classifies the data** — determines the sensitivity level (PUBLIC / INTERNAL / CONFIDENTIAL / REGULATED). Defaults to INTERNAL for this project; upgrades to CONFIDENTIAL if customer data or secrets enter the conversation.
7. **Creates the branch** — runs `git checkout -b <branch-name>` to create and switch to the new branch.
8. **Reports readiness** — confirms all steps completed, states the active data classification, and confirms the active branch.

### When to use it

- **Every new session** — run `/start` before any other command or user request.
- **After a session reset** — if context is lost or a new agent takes over, run `/start` again.

### Fallback

If `/start` is unavailable (e.g., command not yet registered in a fresh clone), execute the manual sequence:
1. Ask the user for task type and description, then agree on a branch name.
2. `skill` with name `governance`
3. `read` on `docs/OPENCODE_WORKFLOW.md`
4. Classify the data (default INTERNAL)
5. `git checkout -b <branch-name>`

### Definition

The command is defined in `.opencode/commands/start.md` and handled by the orchestrator agent.

## Governance & data handling requirements

- **Sharing disabled:** `/share` must remain `manual` or `disabled`. Do not enable automatic sharing; Enterprise doc notes this sends context to opencode.ai infrastructure. If sharing is required, scrub secrets first.
- **Centralized config compliance:** Respect any remote or managed config pulled from `.well-known/opencode` or MDM (Config doc). Do not override managed keys (especially `permissions`, `share`, provider gating).
- **Secrets isolation:** Never store API keys or tokens in the repo. Use `{env:VAR}` expansion from the Config doc and follow `.env.example` patterns.
- **Audit trail:** When touching auth, transport, or telemetry data paths, add entries to `docs/decision-log.md` and mention security review requirements.

## Agent & subagent policy

- **Primary agents:** Build (default, full tools) and Plan (analysis mode) exist even if we primarily use the custom `orchestrator`. Use Plan for threat modeling, Arch updates, and large refactors to avoid unintended edits. (Agents doc)
- **Subagent depth:** The orchestrator agent **must set** `steps: 50` (or higher) so specialized agents (like `@github`) have enough steps to spawn helpers and execute `gh` commands. Without sufficient steps, they fail mid-operation. (Config doc)
- **Task delegation rules:** `permission.task` determines which subagents can be launched automatically. Keep `@security-auditor` gated to security-related tasks; require manual invocation for anything else. (Agents doc)
- **Hidden/aux agents:** Only expose subagents meant for human use. Anything internal should set `hidden: true`. (Agents doc)

## Tooling & permission enforcement

- **Default safety grid:**
  - `read`, `glob`, `grep` → allow, except `*.env*` which remain denied (Permissions doc default).
  - `edit`/`write`/`apply_patch` → ask unless the task is part of an approved plan (individual agents may override; e.g., orchestrator has `edit: allow`).
  - `bash` → ask by default; allowlist `git status*`, `git diff*`, `gh *` for the GitHub agent only (Tools + Permissions docs).
  - `external_directory` → deny everything outside the repo unless explicitly allowlisted per task.
- **Auto mode caution:** Even with `--auto`, explicit `deny` rules win. Avoid launching with `--auto` unless a human is actively monitoring. (Permissions doc)
- **Todo + question tools:** Only the orchestrator may update todos; subagents keep `todowrite` disabled to avoid conflicting plans. (Tools doc)

## Configuration & rules layering

- **Config precedence:** Remote `.well-known/opencode` → `~/.config/opencode/opencode.json` → `.opencode/**`. Later layers override earlier ones only when keys collide. (Config doc)
- **Instructions list:** Maintain `.opencode/agents/orchestrator.md` so OpenCode automatically loads `AGENTS.md`, this playbook, and any other mandatory guides (Rules + Config docs).
- **Managed settings:** If the organization pushes managed configs (MDM / `/Library/Application Support/opencode/`), do not attempt to override them in-project. (Config doc)
- **Rule references:** Keep `AGENTS.md` short; use `@docs/...` references to pull detailed files (Rules doc). When referencing this playbook, instruct agents to `Read` it on demand.

## Model & provider requirements

- **Model IDs:** Always include the `provider/model` prefix (e.g., `opencode/gpt-5.1-codex`). (Models doc)
- **Recommended defaults:** Use one of the models listed under Recommended Models (GPT 5.1/5.2, Claude Sonnet/Opus 4.5, Gemini 3 Pro, Minimax M2.1) unless governance mandates local-only inference. (Models doc)
- **Variants:** Prefer built-in high-reasoning variants for Plan/Security agents and balanced/default variants for Build/Orchestrator. Document any variant overrides in `docs/decision-log.md`. (Models doc)
- **Provider gating:** If enterprise policy requires an internal gateway, disable external providers via `enabled_providers` / `disabled_providers`. (Config + Enterprise docs)
- **No free-tier models:** Free and trial models commonly train on prompts and code. They are prohibited for any project classified INTERNAL or above. Only use models with verified zero-retention guarantees. The project default (`opencode/deepseek-v4-flash`) meets this requirement.

## Live-debugging & deployment workflow

When the user is debugging on the live nanoclaw host (`nanoclaw-host`, nanoclaw-host-ip,
Docker stack at `~/nanoclaw-dashboard`), follow this tight loop so they can
inspect each change on the live box:

1. **Fix** — make the smallest change.
2. **Validate** — `cd backend && pytest && cd ../frontend && npm run lint && npm run build && npm test`.
3. **Push** — commit with `[ai]` attribution in the body, push to `main`.
4. **Deploy** — on the host: `git pull origin main && docker compose up --build -d`.
5. Verify the host is healthy (`curl :8000/health`, frontend title on :4173).

Notes:
- The host runs `NANOCLAW_ENABLED=true` (real data), so the tree renders the
  real agent hierarchy and channel traffic.
- Only real human channels (whatsapp/matrix/etc.) route to the Human node;
  internal `channel:agent` routes to the orchestrator.
- If SSH access is needed, the host alias is `nanoclaw-host`; do not store or echo
  credentials in prompts or logs.

## Repository-specific enforcement checklist

- Load `AGENTS.md` immediately after `/start` and obey its repo-specific workflows (build/test commands, threat modeling, etc.).
- Confirm `.opencode/agents/orchestrator.md` references both `AGENTS.md` and this file in its instructions.
- Confirm agent permission grids are correct (bash allowlist for `gh`, `git` patterns on GitHub agent).
- Record any deviation or newly-learned governance fact in this document (update the _Last reviewed_ date) and mention it in `/handoff`.

By centralizing the OpenCode workflow here, future sessions can cite this single source instead of re-reading the upstream docs every time.
