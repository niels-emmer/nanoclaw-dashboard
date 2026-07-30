---
name: code-standards
description: General code quality standards, naming conventions, function design rules, error handling patterns, and a reviewer rubric. Framework-agnostic. Load before writing or reviewing code.
license: MIT
compatibility: opencode
---

## Naming conventions (language-agnostic guidance)

- **Files:** Match the ecosystem convention (kebab-case for web, snake_case for Python, PascalCase for C# class files).
- **Classes/Structs/Interfaces:** PascalCase. Interfaces prefixed with `I` in C#; no prefix in most other languages.
- **Functions/Methods:** camelCase (JS/TS/Java, Go, Rust) or snake_case (Python, Ruby). Be consistent within the project.
- **Variables:** camelCase or snake_case. Match the project's established style. Never single-letter except for loop indices or well-known math.
- **Constants:** UPPER_SNAKE_CASE or PascalCase depending on language convention.
- **API routes:** RESTful paths, plural nouns (`/api/resources`, `/api/resources/{id}`).
- **Environment variables:** UPPER_SNAKE_CASE.
- **Database fields:** snake_case in SQL; map to the host language convention via ORM.

## Type safety

- **NO `any` or equivalent unchecked types.** Fix the types properly. Use generics, unions, or interfaces rather than escape hatches.
- **Enable strict/linting mode** for the language where available (strict TypeScript, mypy Python, Clippy Rust, etc.).
- **Handle nullability explicitly.** Use `Option`/`Maybe`/nullable types — do not pass or silently accept null.

## Function design

- Single responsibility: one function does one thing.
- Maximum ~20 lines per function body — if longer, extract helpers.
- Return early on error (guard clauses) rather than deep nesting.
- Prefer pure functions: same input → same output, no side effects unless unavoidable.

## Error handling

- Use the language's standard error/result type rather than exceptions for expected failures.
- Use exceptions only for unexpected/unrecoverable conditions.
- Never swallow errors silently (empty catch, bare `except:`, ignored `Result`).
- Log errors with enough context to diagnose. Do not log sensitive data.

## Reviewer rubric

- **MUST FIX** — introduces a bug, breaks a contract, violates security/privacy, or violates hard rules above. Blocks merge.
- **SHOULD FIX** — degrades maintainability, readability, or performance. Resolve before merge but not blocking.
- **SUGGESTION** — optional improvement. Author may accept or defer.

End report with:
- Quality gate: PASSED (no MUST FIX items)
- Quality gate: FAILED — N must-fix items
