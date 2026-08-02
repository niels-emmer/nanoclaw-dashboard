---
description: Load governance skill, read the workflow playbook, and classify data — the mandatory startup ritual for every OpenCode session.
agent: orchestrator
---

Execute the mandatory startup sequence for a new OpenCode session. Do not skip any step.

1. **Load the `governance` skill** — call `skill` with name `governance`
2. **Read `docs/OPENCODE_WORKFLOW.md`** — call `read` on that file
3. **Classify the data** — determine the sensitivity level (PUBLIC / INTERNAL / CONFIDENTIAL / REGULATED). Default to INTERNAL for this project. Upgrade to CONFIDENTIAL if customer data, secrets, or production state enter the conversation.
4. **Report readiness** — confirm all steps completed and state the data classification.

These two steps are not optional. They are the first thing you do in every session, regardless of what the user asks. Only after all steps are complete may you respond.
