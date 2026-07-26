# Security Policy

## Reporting a Vulnerability

We take the security of Nanoclaw Dashboard seriously. If you discover a
security vulnerability, please **do not** open a public GitHub issue.

Instead, report it privately by emailing the maintainers or opening a
[GitHub Security Advisory][gh-advisory] on this repository.

Please include:
- A brief description of the issue
- Steps to reproduce or a proof of concept
- Affected versions (if known)
- Any suggested mitigations

You should receive a response within **48 hours**. If you don't, please
follow up to ensure we received your original message.

We ask that you give us a reasonable window to investigate and release a fix
before public disclosure.

[gh-advisory]: https://github.com/nanoclaw/nanoclaw-dashboard/security/advisories

## Supported Versions

| Version | Supported |
|---------|-----------|
| latest  | yes       |

## Known Security Controls

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for the system design and
[THIRD_PARTY.md](./THIRD_PARTY.md) for dependency provenance.

The WebSocket interface is currently **unauthenticated** and intended for
**trusted LAN / VPN** deployments only. Threat models for all exposed
surfaces live in `docs/threat-models/`. Review them before deploying
outside a controlled network.

## Governance

This repository follows strict governance principles. Key requirements:

- Threat model every new network surface or data store
- Pin dependencies and commit lockfiles
- Generate SBOMs before releases
- Keep documentation up to date with every change
