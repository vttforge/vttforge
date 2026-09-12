---
'@vttforge/cli': patch
---

The scaffold templates pin `@vttforge/core` at `^0.20.0`, the version the
pending release publishes. On a 0.x line a caret pins the minor, so the old
`^0.19.0` would scaffold a project that cannot resolve the core it is written
against.
