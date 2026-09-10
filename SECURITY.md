# Security Policy

## Supported versions

VTTForge is pre-v1.0. Until v1.0 ships, only the **latest released version** of each `@vttforge/*` package receives security fixes.

| Version    | Supported          |
|------------|--------------------|
| v0.x       | Latest minor only  |
| < v0.1     | Not applicable (no release yet) |

Once v1.0 ships, we will widen this policy to cover the current major plus the one before it, for a stated window.

## Reporting a vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Use GitHub's private vulnerability reporting:

→ **[Report a vulnerability](https://github.com/vttforge/vttforge/security/advisories/new)**

This opens a private security advisory visible only to maintainers and the reporter. We will:

1. Acknowledge receipt within **72 hours**.
2. Confirm whether the report is in scope and provide an initial assessment within **7 days**.
3. Keep you updated as we work on a fix; coordinate disclosure timing.
4. Credit you in the advisory and changelog (unless you prefer to remain anonymous).

## Scope

In scope:

- Vulnerabilities in any `@vttforge/*` published npm package
- Supply-chain integrity issues, such as a compromised publish flow or missing provenance
- Issues that allow code execution, data exfiltration, or privilege escalation in a FoundryVTT system or module that consumes VTTForge

Out of scope:

- Vulnerabilities in FoundryVTT itself. Report those to [Foundry Gaming LLC](https://foundryvtt.com/community/contact/)
- Vulnerabilities in third-party dependencies. Report upstream first, and let us know if VTTForge needs to take action
- Issues in user code that only calls VTTForge APIs

## Provenance and supply chain

Since v0.1, every `@vttforge/*` release ships with an [npm provenance attestation](https://docs.npmjs.com/generating-provenance-statements) via GitHub OIDC trusted publishing. Verify an installed package with:

```bash
npm audit signatures
```

If you suspect a published artefact does not match its source repository commit, treat it as a critical incident and report it through the private advisory link above.
