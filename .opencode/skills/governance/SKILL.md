---
name: governance
description: Enterprise governance rules for agentic coding. Data classification, model selection by sensitivity, audit trail, dependency compliance, environment isolation, and AI attribution. Load at session start for enterprise or internet-facing work.
license: MIT
compatibility: opencode
---

## Data classification & AI boundaries

Classify data before sending it to any cloud-hosted model:

| Class | Definition | Permitted models | Rules |
|-------|------------|------------------|-------|
| **PUBLIC** | Open-source code, public docs, no sensitive context | Any Zen or local model | None |
| **INTERNAL** | Proprietary business logic, internal APIs, non-public architecture | Zen US-hosted only (zero-retention verified). No models routed through China or other non-EU/US jurisdictions. | Do not include customer PII, credentials, or trade secrets in prompts. |
| **CONFIDENTIAL** | PII, customer data, credentials, trade secrets, unreleased strategy | Local Ollama models only (`qwen*`, `llama*`). Never send to any cloud API. | Redact or replace with anonymised placeholders before any cloud model interaction. |
| **REGULATED** | HIPAA, GDPR, SOC2-scoped data, financial transactions, health records | Local Ollama models only. No exceptions. | Do not copy, log, or transmit outside the local machine. Zero cloud egress. |

## Audit trail

For enterprise sessions, maintain an audit trail of AI-driven changes:
- `/decision-log` records architecture and workflow decisions in `docs/DECISIONS.md`.
- For each change to production-adjacent code: record file, change, rationale, and attribution.

## Model selection safeguards

- **Never use free-tier or trial models** for INTERNAL, CONFIDENTIAL, or REGULATED work. Free tiers commonly train on prompts and code, which leaks proprietary logic and architecture.
- **Verify zero-retention** before using any model. The model provider must explicitly guarantee that prompts are not stored, logged, or used for training. When in doubt, treat as CONFIDENTIAL and use a local model.
- **Prefer the project's pinned default model** (`opencode/deepseek-v4-flash` in `opencode.json`). Only deviate when a specific task requires a different capability (e.g., a codex model for complex refactoring) and the replacement meets the data classification requirements.
- **Document model changes** in `docs/DECISIONS.md` when overriding the project default for a task or agent.

## Dependency compliance

Before adding a new dependency, check:
- [ ] License is compatible with enterprise use (MIT, Apache 2.0, BSD, LGPL).
- [ ] Package is actively maintained.
- [ ] No known critical CVEs (`npm audit`, `pip audit`).
- [ ] Dependency is pinned to a specific version.
- [ ] Dependency is from a trusted registry (npm, PyPI).
