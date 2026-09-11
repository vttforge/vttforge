---
'@vttforge/cli': patch
---

Point the project templates at the `@vttforge/core` minor that carries the
`api` option and the module-api helpers. On a 0.x line a caret pins the minor,
so the old pin would have scaffolded a project that cannot see them.
