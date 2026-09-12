---
'@vttforge/cli': patch
---

The scaffold templates declare `packageManager` and stop pinning a pnpm
version in the release workflow.

`pnpm/action-setup` refuses to run when a `version` input and a
`packageManager` field both name a pnpm version. The templates set the input
and left the field out, so a project that later added `packageManager`, which
is what Corepack asks for, broke its own release workflow with `Multiple
versions of pnpm specified`. The manifest field is now the one source.
