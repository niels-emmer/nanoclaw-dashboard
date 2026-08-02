# OpenCode Workflow & Governance Playbook

_Last reviewed: 2026-07-31_

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

1. **Classify the data** (Enterprise doc) — treat everything here as at least _Internal_. Upgrade to _Confidential_ if customer data, secrets, or production state enter the conversation; in that case restrict to local/on-prem models only.
2. **Load governance instructions first** — read this playbook, then `AGENTS.md`, then any file referenced by `opencode.json.instructions`. (Rules doc)
3. **Plan before non-trivial edits** — use `/plan` (Plan agent) whenever a task spans multiple files or requires more than one command. (Agents doc)
4. **Delegate intentionally** — prefer the orchestrator primary agent for coordination, `@explorer` for read-only discovery, `@github` for CLI-driven repository/PR work, `@reviewer` for code/doc QA, and `@security-auditor` for security gates. (Agents doc)
5. **Enforce tool/permission approvals** — follow the ask/allow/deny grid defined in `.opencode/agents/*.md` and `opencode.json`. Never bypass user confirmation for denied or ask-marked operations even if auto-approve is enabled. (Tools + Permissions docs)
6. **Verify before completion** — run the narrowest meaningful check (tests, linters, `gh` status) before reporting success. (Rules doc > Verify Before Done)
7. **Document the session** — update todos, ADRs, and DECISIONS when behavior changes. Record AI-authored work in `/handoff`. (Rules + repo governance section)

## Governance & data handling requirements

- **Sharing disabled:** `/share` must remain `manual` or `disabled`. Do not enable automatic sharing; Enterprise doc notes this sends context to opencode.ai infrastructure. If sharing is required, scrub secrets first.
- **Centralized config compliance:** Respect any remote or managed config pulled from `.well-known/opencode` or MDM (Config doc). Do not override managed keys (especially `permissions`, `share`, provider gating).
- **Secrets isolation:** Never store API keys or tokens in the repo. Use `{env:VAR}` expansion from the Config doc and follow `.env.example` patterns.
- **Audit trail:** When touching auth, transport, or telemetry data paths, add entries to `docs/DECISIONS.md` and mention security review requirements.

## Agent & subagent policy

- **Primary agents:** Build (default, full tools) and Plan (analysis mode) exist even if we primarily use the custom `orchestrator`. Use Plan for threat modeling, Arch updates, and large refactors to avoid unintended edits. (Agents doc)
- **Subagent depth:** Project `opencode.json` **must set** `"subagent_depth": 2` so specialized agents (like `@github`) can spawn read/write-capable helpers to execute `gh` commands. Without this, they fail when a bash-capable helper is required. (Config doc)
- **Task delegation rules:** `permission.task` determines which subagents can be launched automatically. Keep `@security-auditor` gated to security-related tasks; require manual invocation for anything else. (Agents doc)
- **Hidden/aux agents:** Only expose subagents meant for human use. Anything internal should set `hidden: true`. (Agents doc)

## Tooling & permission enforcement

- **Default safety grid:**
  - `read`, `glob`, `grep` → allow, except `*.env*` which remain denied (Permissions doc default).
  - `edit`/`write`/`apply_patch` → ask unless the task is part of an approved plan.
  - `bash` → ask by default; allowlist `git status*`, `git diff*`, `gh *` for the GitHub agent only (Tools + Permissions docs).
  - `external_directory` → deny everything outside the repo unless explicitly allowlisted per task.
- **Auto mode caution:** Even with `--auto`, explicit `deny` rules win. Avoid launching with `--auto` unless a human is actively monitoring. (Permissions doc)
- **Todo + question tools:** Only the orchestrator may update todos; subagents keep `todowrite` disabled to avoid conflicting plans. (Tools doc)

## Configuration & rules layering

- **Config precedence:** Remote `.well-known/opencode` → `~/.config/opencode/opencode.json` → project `opencode.json` → `.opencode/**`. Later layers override earlier ones only when keys collide. (Config doc)
- **Instructions list:** Maintain `opencode.json.instructions` so OpenCode automatically loads `AGENTS.md`, this playbook, and any other mandatory guides (Rules + Config docs).
- **Managed settings:** If the organization pushes managed configs (MDM / `/Library/Application Support/opencode/`), do not attempt to override them in-project. (Config doc)
- **Rule references:** Keep `AGENTS.md` short; use `@docs/...` references to pull detailed files (Rules doc). When referencing this playbook, instruct agents to `Read` it on demand.

## Model & provider requirements

- **Model IDs:** Always include the `provider/model` prefix (e.g., `opencode/gpt-5.1-codex`). (Models doc)
- **Recommended defaults:** Use one of the models listed under Recommended Models (GPT 5.1/5.2, Claude Sonnet/Opus 4.5, Gemini 3 Pro, Minimax M2.1) unless governance mandates local-only inference. (Models doc)
- **Variants:** Prefer built-in high-reasoning variants for Plan/Security agents and balanced/default variants for Build/Orchestrator. Document any variant overrides in `docs/DECISIONS.md`. (Models doc)
- **Provider gating:** If enterprise policy requires an internal gateway, disable external providers via `enabled_providers` / `disabled_providers`. (Config + Enterprise docs)

## Repository-specific enforcement checklist

- Load `docs/OPENCODE_WORKFLOW.md` (this file) before every session; its rules are authoritative for OpenCode usage.
- Load `AGENTS.md` immediately after and obey its repo-specific workflows (build/test commands, threat modeling, etc.).
- Confirm `opencode.json` includes:
  - `instructions` pointing to both `AGENTS.md` and this file.
  - `subagent_depth: 2`.
  - Permission overrides for GitHub agent bash patterns.
- Disable `/share` unless explicitly requested for sanitized transcripts.
- Record any deviation or newly-learned governance fact in this document (update the _Last reviewed_ date) and mention it in `/handoff`.

By centralizing the OpenCode workflow here, future sessions can cite this single source instead of re-reading the upstream docs every time.
