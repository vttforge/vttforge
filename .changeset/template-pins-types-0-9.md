---
'@vttforge/cli': patch
---

The `system-ts` and `module-ts` templates pin `@vttforge/types` to `^0.9.0`. On
a 0.x line a caret pins the minor, so the old pin would scaffold a project that
cannot resolve the version this release publishes.
