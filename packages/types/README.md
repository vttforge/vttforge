# @vttforge/types

The TypeScript surface shared across VTTForge packages.

```bash
pnpm add -D @vttforge/types
```

## What is in it

The Foundry members the base factories in `@vttforge/core` stand on:

| Export | What it is |
|---|---|
| `ApplicationV2Members` | The `ApplicationV2` members a sheet or application built on the SDK can rely on: `element`, `title`, `rendered`, `options`, `render`, `close`, `_prepareContext`, `_onRender`, `_onFirstRender` |
| `DocumentSheetV2Members` | The above plus `document` (typed `unknown`, yours to narrow) and `isEditable` |
| `VttforgeClass<Added, Statics, Foundry>` | The shape a base factory returns: what the SDK adds, the statics, and the part of Foundry it stands on |

The surface is deliberately small. Every member is one a real consumer used, not one that merely exists in Foundry. Reaching a member that is not here is a cast, and a cast is a sentence you write on purpose.

`@vttforge/core` depends on this package and re-exports the same names, so a system that only imports from core does not need to add it. Import from here when you write types that stand on their own, such as a shared interface for a family of sheets.

## Docs

- [Sheets](https://vttforge.dev/docs/guide/sheets)
- [Stability](https://vttforge.dev/docs/stability)
