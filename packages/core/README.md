# @vttforge/core

The runtime half of [VTTForge](https://vttforge.dev): what a Foundry VTT v14+ system or module imports. A module reaches for everything below, plus the four rows marked for modules.

```bash
pnpm add @vttforge/core
```

## What is in it

| Export | What it replaces |
|---|---|
| `registerSystem` / `registerModule` | The `Hooks.once("init")` block: data models, document classes, initiative, status effects, sheets, enrichers, and `ready` |
| `BaseTypeDataModel(defineSchema)` | A `TypeDataModel` whose fields are typed from the schema, so `this.level` is a `number` inside `prepareDerivedData` |
| `fields()` | `foundry.data.fields`, typed, read lazily so the module imports in Node |
| `InferSchema<T>` / `Model['$inferData']` | The hand-written interface that drifts from the schema |
| `BaseActorSheet()` / `BaseItemSheet()` | `static TABS`, `static DRAG_DROP`, `static MODES` (play and edit, with the fields locked in play), typed `onDropItem` and friends on `ActorSheetV2` / `ItemSheetV2` with Handlebars |
| `resourceField()` | The `{ value, max }` field a token bar reads, typed as two numbers; `registerSystem` checks the manifest's bars against it |
| `postRoll()` | Posts a roll as a chat card, tagged as a critical or a fumble by the thresholds you give |
| `dicePool()` / `stepDie()` / `countSuccesses()` | The pool formula from a description, a die stepped along a ladder, successes counted on any roll |
| `promptFields()` | A dialog from a list of fields, built with Foundry's input helpers, resolving to a typed object or `null` |
| `keywords` on either registration | Rules terms as `@Keyword[id]` with a tooltip, and a journal entry the GM's client creates and keeps current |
| `BaseDocumentSheet('Actor' \| 'Item')` / `BaseApplication()` | The same plumbing without Handlebars, for a sheet that builds its own element |
| `PackageConfig` | `game.settings.register/get/set` with the package id filled in and unregistered reads caught |
| `createMigrationRunner` | The `schemaVersion` setting, the `isNewerVersion` compare and the sequential `await` every system grows |
| `moduleSubType` | The `<module id>.<type>` prefix Foundry files a module's sub-types under |
| `registerSocket` | The `game.socket` channel, the manifest flag it needs, the sender id the server vouched for, and requests only a Gamemaster's client can answer |
| `moduleApi` / `requireModuleApi` | Reading another package's api, and saying which of not installed, switched off or publishing nothing it was |
| `subTypeDocuments` / `convertSubTypes` | Counting what a module's sub-types hold, and converting them back so uninstalling it strands nothing |
| `inject` | Your own UI inside an application you do not own, replaced on each re-render rather than stacked |
| `VttfError` | Runtime errors with a stable `VTTF-NNNN` code and a docs URL |

## Registering a sheet

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

Foundry keys a sheet by its class name and saves that key on every document. A bundler renames classes between builds, so `registerSystem` uses the `id` for the key instead.

## Docs

- [Getting started](https://vttforge.dev/docs/guide/getting-started)
- [Data models](https://vttforge.dev/docs/guide/data-models)
- [Sheets](https://vttforge.dev/docs/guide/sheets)
- [Modules](https://vttforge.dev/docs/guide/modules)
- [Sockets](https://vttforge.dev/docs/guide/sockets). `registerSocket`: one-way messages, and questions only the Gamemaster's client can answer.
- [Error codes](https://vttforge.dev/docs/errors/)

Foundry v14+ only. The package runs in the browser inside Foundry; it reads the Foundry globals lazily, so it also imports cleanly in Node for tests.
