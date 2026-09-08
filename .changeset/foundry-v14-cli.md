---
'@vttforge/cli': minor
---

Target Foundry v14.

- `vttforge init` writes `"type"` into the manifest and sets `compatibility` to `{ "minimum": "14", "verified": "14" }`. The system templates no longer unregister the core sheets, because v14 registers none.
- `vttforge audit` gains six rules for the v13 code v14 broke or deprecated: bare utility globals such as `mergeObject` (`VTTF-AUDIT-011`, HIGH), `-=` / `==` update keys (012), `rollMode` (013), whole-array `CONFIG.statusEffects` assignment (014), `legacyTransferral` (015) and numeric Active Effect modes (016). `VTTF-AUDIT-002` is now HIGH: v14 dropped the shim for the flat `gridDistance` / `gridUnits` keys.
