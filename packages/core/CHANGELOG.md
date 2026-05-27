# @vttforge/core

## 0.3.0

### Minor Changes

- 234a4b2: Extend `BaseActorSheet` and add `BaseItemSheet` — the boilerplate every shipping
  system copy-pastes is now hoisted into the SDK.

  - `static DRAG_DROP` — declare drag sources / drop targets as data; the base
    wires real `foundry.applications.ux.DragDrop` instances in `_onRender` with
    `isEditable`-gated permissions and a default `_onDragStart` that serialises
    `data-item-id` elements as `{ type: "Item", uuid }`.
  - `_prepareContext` auto-fills `context.tabs[group]` for every group declared
    in ApplicationV2's `static TABS`, eliminating manual `_prepareTabs(group)`
    calls in subclass `_prepareContext`.
  - Typed drop dispatch: override `onDropItem(item, event)` / `onDropActor(...)` /
    `onDropFolder(...)` / `onDropActiveEffect(...)` and skip the `fromUuid()`
    ceremony. Returning `undefined` falls through to Foundry's default
    `_onDropX`; return anything else to take ownership.
  - New `BaseItemSheet()` mirror with the same `static DRAG_DROP` + tab
    auto-population, minus the drop dispatch (items rarely receive drops).
  - Exports new `DragDropConfig` type for typed `static DRAG_DROP` declarations.

  `editImage` is intentionally not reinvented — it already ships on
  `DocumentSheetV2` (inherited by both `ActorSheetV2` and `ItemSheetV2`).
  Templates wire `<img data-edit="img">` and Foundry's built-in action handles
  the `FilePicker` flow.

- 4fd5a07: Error registry codegen — `docsUrl` now resolves to a real page.

  `postbuild` hook (`packages/core/scripts/codegen-errors.mjs`) reads the
  just-built `dist/index.mjs`, calls `listErrorEntries()`, and emits:

  - `dist/errors-manifest.json` — versioned JSON catalogue shipped in the
    tarball alongside the bundled JS/types. Stable shape (`version`,
    `package`, `packageVersion`, `entries[]`) so external tooling (the v0.3
    docs site, IDE extensions, lint rules) has a single source of truth.
  - `docs/errors/VTTF-NNNN.md` at the repo root — one Markdown stub per code,
    committed so the `docsUrl` already resolves while the full VitePress site
    is being built in v0.3.

  New runtime helper: `getErrorManifest()` returns the same data as
  `listErrorEntries()`, wrapped in a typed `ErrorManifest` envelope with a
  stable `version: 1` field for future format migrations.

  Plan deviation: the original `.internal/v0.1-next-steps.md` PR 8 spec said
  `prebuild`, but `postbuild` lets the script import the just-built ESM
  directly instead of needing `tsx`/`unrun` to load the TS source.
  Documented inline in the codegen script.

- 0896bb0: Add `createMigrationRunner()` for declarative schema migrations, plus
  `onReady` lifecycle on `registerSystem()`.

  `createMigrationRunner({ systemId, migrations, ... })` returns `{ register(),
run(), targetVersion }`. Call `register()` from `init` to register the
  `schemaVersion` setting; call `run()` from `ready` (gated by
  `game.user.isGM`) to execute every pending migration in order. Migrations use
  semver versions and `foundry.utils.isNewerVersion` for comparison, the same
  contract `system.json`'s `flags.<systemId>.needsMigrationVersion` /
  `compatibleMigrationVersion` use.

  Failure semantics: `schemaVersion` is committed per-migration, so a
  mid-sequence throw leaves the world at the last successful version and the
  retry on the next world load picks up exactly where it failed. Migration
  errors are wrapped in `VttfError VTTF-0004` with the original error on
  `.cause`; calling `run()` against a world older than `compatibleVersion`
  throws `VttfError VTTF-0005`.

  `registerSystem()` gains `onReady?: () => void | Promise<void>` — the natural
  place to wire `migrationRunner.run()`. Not GM-gated; consumer guards inside
  their callback.

  New error codes (append-only): `VTTF-0004 MigrationFailed`,
  `VTTF-0005 WorldTooOldForMigration`.

- 49a8718: Fix `BaseActorSheet` / `BaseItemSheet` tab handling so sheets work without
  per-consumer workarounds.

  Two issues surfaced when running the example sheet inside a live Foundry v13:

  - **`context.tabs` double-wrap on single-group sheets.** The previous
    `_prepareContext` override unconditionally set `context.tabs[group]`,
    even when ApplicationV2 already populated a flat
    `context.tabs[tabId]` for single-group sheets. The collision forced
    consumers to either unwrap manually or write `context.tabs.<group>.<tabId>`
    in every template. Fixed: BaseActorSheet/BaseItemSheet now only fill
    `context.tabs[group]` for **multi-group** sheets (single-group sheets
    see ApplicationV2's flat shape untouched).

  - **No default `tab`-style action handler.** ApplicationV2 doesn't ship a
    built-in handler for `data-action="…"` tab navigation buttons, and the
    bare name `tab` is reserved by the framework (custom handlers under that
    name never fire). Fixed: both base sheets now ship a `vttforgeTab`
    action that toggles `.active` on the matching nav button
    (`[data-action="vttforgeTab"][data-group=…][data-tab=…]`) and content
    section (`section.tab[data-group=…][data-tab=…]`) and updates
    `sheet.tabGroups[group]`. Templates that already used the old per-sheet
    workaround need to rename `data-action="tab"` → `data-action="vttforgeTab"`.

  Discovered during development testing — not derived from any external
  source.

  Patch bump for the example: drops the `_prepareContext` unwrap workaround
  and the per-sheet `_onTab` static handlers added in the previous PR,
  since both now live in the SDK.

## 0.2.0

### Minor Changes

- 5dd98c1: Add `fields()` factory and `InferSchema<T>` for typed `defineSchema()` outputs.

  Covers the v0.1 partial scope from PRD §7: `NumberField`, `StringField`,
  `BooleanField`, `HTMLField`, `ArrayField`, `SchemaField`, `ColorField`,
  `FilePathField`. Calling `fields()` lazy-resolves `globalThis.foundry.data.fields`
  and throws `VttfError VTTF-0002` outside the Foundry runtime — same pattern as
  `BaseTypeDataModel()` / `BaseActorSheet()`.

  `InferSchema<S>` derives the `system` shape from a `defineSchema()` return value,
  recursing through `ArrayField` and `SchemaField` and honouring the single
  nullability rule `nullable: true` → `T | null`. Full class-level inference
  (`BaseTypeDataModel<typeof Schema>`), `$inferData`, `EmbeddedDataField`,
  `EmbeddedDocumentField`, `TypedSchemaField`, and the full required×initial
  nullability matrix remain v1.0 scope and will ship from `@vttforge/types`.

## 0.1.0

### Minor Changes

- 4900e83: Foundation MVP (PR 4 of 4) — `@vttforge/core` ships its first runtime surface (registerSystem, SystemConfig, BaseTypeDataModel, BaseActorSheet, VttfError + VTTF-NNNN registry) and `@vttforge/styles` ships its first `--vttf-*` token set wrapped in the `vttforge.tokens` cascade layer.

  Both packages have working consumer entrypoints (verified by an external smoke test loading the built `.mjs` from a throwaway dir) and the SDK contracts match the canonical Foundry v13 patterns (TypeDataModel migration, ActorSheetV2 + HandlebarsApplicationMixin, staged init hooks, marker classes).

  Status remains pre-1.0 and APIs are explicitly unstable — these are the first releases that have real code instead of placeholder `export {}`.

## 0.0.1

Initial functional release (v0.1 MVP slice). Foundry v13+ system runtime helpers.

### Added

- `registerSystem({ id, actorDataModels, itemDataModels, actorDocumentClass, itemDocumentClass, combat, statusEffects, onBeforeInit, onAfterInit })` — one-call boot that schedules CONFIG mutations via `Hooks.once("init", ...)`. Idempotent per `id` (throws `VTTF-0001` on duplicate). Sets `CONFIG.ActiveEffect.legacyTransferral = false` by default.
- `SystemConfig` — typed wrapper around `game.settings.register/get/set`. Tracks registered keys locally; reads/writes against an unregistered key throw `VTTF-0003` instead of returning `undefined`.
- `BaseTypeDataModel()` — mixin over `foundry.abstract.TypeDataModel` providing a safe default `migrateData` that delegates to `super` (chained-migration guard), a stub `_addDataFieldMigrations`, and a no-op `prepareDerivedData`.
- `BaseActorSheet()` — mixin over `HandlebarsApplicationMixin(foundry.applications.sheets.ActorSheetV2)` with `DEFAULT_OPTIONS` that ship the `vttforge` marker class so consumers can scope CSS without specificity wars.
- `VttfError` + `VTTF-NNNN` registry — central, append-only error codes (`VTTF-0001` SystemAlreadyRegistered, `VTTF-0002` MissingFoundryGlobals, `VTTF-0003` UnknownSetting), each with a `name`, `summary`, and `docsUrl` pointing at `https://vttforge.dev/errors/VTTF-NNNN`. Supports native ES2022 `cause` and `AggregateError`.

### Verified

- 32 Vitest unit tests across 5 files, all passing on Node 22.14 and Node 24.
- External consumer smoke test (importing the published `.mjs` from a throwaway dir) confirms every exported symbol behaves as designed when Foundry globals are present or absent.
