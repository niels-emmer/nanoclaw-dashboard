# Nanoclaw Dashboard Agent Instructions

## Global Coding Rules

### Edit-time rules

1. **Think Before Coding** — State assumptions explicitly. If uncertain, ask rather than guess; stop and name what's unclear instead of guessing through it. Surface tradeoffs before proceeding.
2. **Simplicity First** — Write the minimum code that solves the problem. No features beyond what was asked, nothing speculative. If 200 lines could be 50, write the 50.
3. **Surgical Changes** — Touch only what the request requires. Match existing style even if you'd do it differently. No drive-by refactors or unrelated "improvements".
4. **Goal-Driven Execution** — Turn the task into machine-verifiable success criteria before writing code. Define what "done" looks like, then loop until those checks pass.

### Agent self-check rules

5. **Debugging Discipline** — Read the full error and stack trace before acting. Reproduce the problem before attempting a fix. Change one variable at a time. Beware confident wrong diagnosis: never generate a fix for a problem you have not confirmed.
6. **Reproduce Before Fixing** — Before fixing a bug, write a test that reliably reproduces it. Fix the code. Run the test. The bug is fixed only when the test passes — not when it "feels" fixed.
7. **Dependency Hygiene** — Treat every added package as permanent, uncontrolled code maintained on someone else's schedule. Ask whether the standard library handles it first. If you add a dependency, document the decision explicitly.
8. **Honest Communication** — Report actionable uncertainty, not vague reassurance. "I'm not sure this library supports streaming" is useful; "I think this should work" is not. Never dress up a guess as confidence.
9. **Recognize Failure Modes** — In autonomous loops no human reviews each step. Watch for and halt on the known traps: confident wrong diagnosis, fixes that only "feel" right, scope creep, silent guessing past confusion. Stop and flag rather than push through.
10. **Verify Before Done** — Nothing is complete until its success criteria are demonstrably met (tests run, output matches the goal). "Looks correct" is not "runs correctly". Close the loop with evidence.

## Governance rules (enterprise + internet-facing apps)

11. **Data Classification** — Before sending data to any cloud model, classify it: PUBLIC (any model), INTERNAL (Zen US-hosted only, zero-retention), CONFIDENTIAL (local Ollama only, no cloud egress), REGULATED (local only, no exceptions). When in doubt, treat as CONFIDENTIAL. Never paste customer PII, credentials, or production secrets into AI prompts.
12. **Secrets Isolation** — Never inline secrets, tokens, connection strings, or API keys in code, prompts, or docs. Use `{env:VAR}` references, gitignored `.env` files, or a secrets manager. If you see a secret in a prompt or file, flag it immediately and do not proceed until it is redacted.
13. **Dependency License Gate** — Before adding a dependency, verify: OSI-approved license (MIT, Apache 2.0, BSD, LGPL — not AGPL or unlicensed), actively maintained, no critical CVEs, pinned to a specific version, from a trusted registry.
14. **Environment Isolation** — Never mix personal and enterprise credentials, tokens, or accounts in the same session. Flag any detected cross-contamination.
15. **Audit Trail** — For enterprise sessions, record AI-driven changes: what changed, why, and whether it was AI-authored or human-authored. Use `/decision-log` for architecture decisions.
16. **Human Review for Risk** — AI-generated changes to auth, payments, cryptography, data access, or production infrastructure must have a human review before merge.
