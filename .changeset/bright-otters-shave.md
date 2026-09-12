---
"@vttforge/types": patch
---

Add `@vttforge/types/foundry-api`, which declares every name in Foundry's published API reference: 675 classes, 485 interfaces, 289 functions and 218 type aliases across 112 namespaces.

It declares the `foundry` global. Reach it with `/// <reference types="@vttforge/types/foundry-api" />` in a file, or with `"types": ["@vttforge/types/foundry-api"]` in `tsconfig.json` for the whole project.

Nothing changes for code that imports from `@vttforge/types` today. The new entry point stands on its own and re-exports nothing, so a name means one thing wherever you read it.
