---
'@vttforge/cli': patch
---

The scaffold templates pinned `packageManager: pnpm@11.25.0` and
`pnpm/action-setup@v4`, both a major version behind current pnpm (12.4.1)
and the action VTTForge's own CI already runs (`@v6`). A project scaffolded
today inherited both stale pins. Bumped all four templates
(`system-ts`, `system-js`, `module-ts`, `module-js`) to match.
