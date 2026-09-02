# @vttforge/core

The runtime half of [VTTForge](https://vttforge.dev): what a Foundry VTT v13+ system or module imports.

```bash
pnpm add @vttforge/core
```

## What is in it

| Export | What it replaces |
|---|---|
| `registerSystem` / `registerModule` | The `Hooks.once("init")` block: data models, document classes, initiative, status effects, sheets, enrichers, and `ready` |
| `BaseTypeDataModel(defineSchema)` | A `TypeDataModel` whose fields are typed from the schema — `this.level` is a `number` inside `prepareDerivedData` |
| `fields()` | `foundry.data.fields`, typed, read lazily so the module imports in Node |
| `InferSchema<T>` / `Model['$inferData']` | The hand-written interface that drifts from the schema |
| `BaseActorSheet()` / `BaseItemSheet()` | `static TABS`, `static DRAG_DROP`, typed `onDropItem` and friends on `ActorSheetV2` / `ItemSheetV2` with Handlebars |
| `BaseDocumentSheet('Actor' \| 'Item')` / `BaseApplication()` | The same plumbing without Handlebars, for a sheet that builds its own element |
| `SystemConfig` | `game.settings.register/get/set` with the package id filled in and unregistered reads caught |
| `createMigrationRunner` | The `schemaVersion` setting, the `isNewerVersion` compare and the sequential `await` every system grows |
| `moduleSubType` | The `<module id>.<type>` prefix Foundry files a module's sub-types under |
| `VttfError` | Runtime errors with a stable `VTTF-NNNN` code and a docs URL |

## A sheet, registered so its key does not move

```ts
import { BaseActorSheet, registerSystem } from '@vttforge/core';

class CharacterSheet extends BaseActorSheet() {
  static PARTS = { sheet: { template: 'systems/my-system/templates/character.hbs' } };
}

registerSystem({
  id: 'my-system',
  actorDataModels: { character: CharacterData },
  sheets: [{ id: 'character', document: 'Actor', sheet: CharacterSheet, types: ['character'], makeDefault: true }],
});
```

Foundry keys a sheet by its class name and saves that key on every document. A bundler renames classes between builds; the `id` is written down, so the key stays.

## Docs

- [Getting started](https://vttforge.dev/docs/guide/getting-started)
- [Data models](https://vttforge.dev/docs/guide/data-models)
- [Sheets](https://vttforge.dev/docs/guide/sheets)
- [Modules](https://vttforge.dev/docs/guide/modules)
- [Error codes](https://vttforge.dev/docs/errors/)

Foundry v13+ only. The package runs in the browser inside Foundry; it reads the Foundry globals lazily, so it also imports cleanly in Node for tests.
