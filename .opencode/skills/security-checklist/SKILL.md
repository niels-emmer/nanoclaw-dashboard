---
name: security-checklist
description: Structured security review checklist and finding report format for the security-auditor agent. Covers secrets, auth, injection, data handling, and error handling.
license: MIT
compatibility: opencode
---

## Review checklist

### A. HARD BLOCKS
- [ ] NO secrets in code or repo.
- [ ] NO unauthenticated API/service endpoints.
- [ ] NO empty catch blocks.
- [ ] NO unvalidated input to dangerous execution contexts.

### B. Input validation & Data Protection
- [ ] All inputs validated via Pydantic / TypeScript types.
- [ ] No PII or credentials logged in structlog output.

## Finding report format

```
### [SEVERITY] Short title

File: path/to/file.ext  Line: N
Description: What the vulnerability is and how it can be exploited.
Remediation: Exact code or config change required to fix it.
```

SEVERITY: CRITICAL | HIGH | MEDIUM | LOW
