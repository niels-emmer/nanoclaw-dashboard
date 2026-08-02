---
description: Interactive session startup — prompt for task type and description, suggest a branch, then load governance, read the playbook, classify data, and create the branch.
agent: orchestrator
---

Execute the interactive startup sequence for a new OpenCode session. Do not skip any step.

1. **Prompt for task type** — Ask the user what type of work this is. Present these options:
   - `feature` — new functionality
   - `fix` — bug fix
   - `chore` — maintenance, tooling, CI
   - `docs` — documentation
   - `refactor` — code restructuring
   - `test` — test additions or changes
   
   Wait for the user to choose one.

2. **Prompt for description** — Ask the user for a short description of the task (2-6 words). This will be used to generate the branch name.

3. **Suggest a branch name** — Generate a branch name using the pattern `<type>/<kebab-case-description>` (e.g., `feature/add-login-page`, `fix/null-pointer-deref`). Present it to the user and ask if they'd like to accept it or provide a different name. Wait for confirmation or an alternative.

4. **Load the `governance` skill** — call `skill` with name `governance`.

5. **Read `docs/OPENCODE_WORKFLOW.md`** — call `read` on that file.

6. **Classify the data** — determine the sensitivity level (PUBLIC / INTERNAL / CONFIDENTIAL / REGULATED). Default to INTERNAL for this project. Upgrade to CONFIDENTIAL if customer data, secrets, or production state enter the conversation.

7. **Create the branch** — run `git checkout -b <branch-name>` to create and switch to the new branch.

8. **Report readiness** — confirm all steps completed, state the data classification, and confirm the active branch.
