---
'@vttforge/cli': patch
---

The templates now pin `@vttforge/types` at `^0.7.0`. On a 0.x line a caret pins the minor, so the old `^0.6.0` would scaffold a project that cannot resolve the types this release publishes.
