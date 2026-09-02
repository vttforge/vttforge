---
"@vttforge/types": minor
"@vttforge/core": patch
---

`@vttforge/types` now holds the Foundry surface the base factories stand on: `ApplicationV2Members`, `DocumentSheetV2Members` and `VttforgeClass`. `@vttforge/core` depends on it and re-exports the same names, so nothing changes for a system that imports from core.
