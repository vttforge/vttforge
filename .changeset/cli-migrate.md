---
'@vttforge/cli': minor
---

`vttforge migrate` rewrites a v13 system or module for v14: bare `mergeObject`-style globals, `-=` and `==` update keys, `rollMode`, context-menu and header-control keys, numeric Active Effect modes, whole-array `CONFIG.statusEffects` assignment, `legacyTransferral`, the core-sheet unregister lines, and the manifest's `type` and `compatibility`. It reports by default and writes with `--write`; what it cannot decide it reports as needing a decision.
