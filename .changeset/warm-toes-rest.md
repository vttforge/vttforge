---
'@vttforge/cli': patch
---

The template typecheck now resolves `@vttforge/types` to source, the way it already resolved `@vttforge/core`. It read a built copy before, and a stale build hid two real type errors in the templates.
