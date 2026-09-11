---
'@vttforge/cli': patch
---

Point the project templates at the `@vttforge/core` minor that renames
`SystemConfig` to `PackageConfig`, and switch the scaffolded code to the new
name. On a 0.x line a caret pins the minor, so the old pin would have
scaffolded a project that cannot resolve it.
