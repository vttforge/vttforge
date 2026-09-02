# @vttforge/types

Shared TypeScript types for [VTTForge](https://vttforge.dev).

Today the package exports a version constant and nothing else. The Foundry members the sheet and application bases stand on (`ApplicationV2Members`, `DocumentSheetV2Members`, `VttforgeClass`) live in `@vttforge/core` for now, because that is where they are used.

This package is where the shared Foundry surface moves once it is wide enough to be worth a package of its own, and once `fvtt-types` for v13 settles enough to build on. Until then, depend on `@vttforge/core`.
