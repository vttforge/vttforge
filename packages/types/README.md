# @vttforge/types

The TypeScript types shared across VTTForge packages.

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

The list is short on purpose: every member on it is one a real consumer used. Reaching a member that is not here takes a cast.

`@vttforge/core` depends on this package and re-exports the same names, so a system that only imports from core does not need to add it. Import from here when you write types that stand on their own, such as a shared interface for a family of sheets.

## The whole Foundry API

`@vttforge/types/foundry-api` declares every name in Foundry's published API
reference: 673 classes, 485 interfaces, 289 functions and 218 type aliases,
across 112 namespaces. It declares the `foundry` global, so a file reaches it
with a reference directive rather than an import:

```ts
/// <reference types="@vttforge/types/foundry-api" />

export function describe(actor: foundry.documents.Actor): string {
  return `${actor.name} (${actor.type})`;
}
```

Or once, in `tsconfig.json`, for every file in the project:

```json
{ "compilerOptions": { "types": ["@vttforge/types/foundry-api"] } }
```

The declarations are generated from the reference and carry its signatures, not
its prose. About six percent of members come through as `any`, where a subclass
page and its base page disagree about a type and the reference does not say
which is right. The rest carry what the reference says.

The names above are the SDK's own surface, kept short and checked against real
consumers. This entry point is the other thing: everything Foundry documents,
whether or not the SDK has an opinion about it. Nothing is re-exported between
the two, so a name means one thing wherever you read it.

## Docs

- [Sheets](https://vttforge.dev/docs/guide/sheets)
- [Stability](https://vttforge.dev/docs/stability)
