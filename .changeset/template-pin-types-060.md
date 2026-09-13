---
'@vttforge/cli': patch
---

The TypeScript templates pin `@vttforge/types` at `^0.6.0`.

On a 0.x line a caret pins the minor, so the old `^0.5.0` would scaffold a
project that cannot resolve the version this release publishes.
