# @vttforge/core

## 0.5.0

### Minor Changes

- 9462144: Require Node 26.

  The floor moves from `>=22.14.0` to `>=26.0.0` across every package and the
  four scaffolding templates, and the bundler target for the Node-side
  packages moves from `node22` to `node26`.

  Node 22 entered maintenance in October 2025 and receives security fixes
  only. Node 26 becomes the active LTS line on 2026-10-28.

  This is breaking for anyone on Node 22 or 24. It is marked `minor` rather
  than `major` on purpose: these packages are still on 0.x, where a minor
  signals the break, and a major would push every package to 1.0.0 — a claim
  of API stability that has not been audited, on packages two of which are
  still stubs.

  The templates move to the versions this release publishes. On 0.x a caret
  pins the minor, so their old ranges would not have matched.

  CI now pins Node through `actions/setup-node` instead of inheriting whatever
  the runner image ships, so the version the packages declare is the version
  they are tested on. It was not before: the workflow took the image's Node,
  and nothing enforced the declared floor because `engine-strict` is not set.

## 0.4.0

### Minor Changes

- 50721f9: fix: align with Foundry v13 manifest schema and add `prepareBaseData` hook

  Three coordinated changes:

  **`@vttforge/core`** — `BaseTypeDataModel()` now ships a `prepareBaseData()`
  no-op stub alongside `prepareDerivedData()`. Use `prepareBaseData()` to
  initialize fields that Active Effects need to mutate (base max HP, base AC),
  since AEs apply between `prepareBaseData()` and `prepareDerivedData()`.
  `prepareDerivedData()` stays the place for values that depend on the
  AE-mutated state.

  The misleading `_addDataFieldMigrations()` static stub is removed. The real
  field-rename API is `_addDataFieldMigration(source, oldKey, newKey, apply?)`
  called inside a `static migrateData(source)` override — consumers who need
  it can call it directly on the Foundry-provided base via `super`.

  **`@vttforge/vite-plugin`** — emits the canonical v13 `styles` form
  (`[{ src: "styles/foo.css" }]`) in the built manifest. Still accepts the
  legacy string form (`["styles/foo.css"]`) and the v13 object form as input,
  so existing consumers don't need to change their source manifest. Additional
  metadata declared on object entries (e.g. `layer` for cascade layer
  placement) is preserved through the rewrite — only `src` is rewritten to
  point at the bundled output.

  **`@vttforge-examples/simple-system`** — manifest aligned with v13 schema:
  `gridDistance` / `gridUnits` collapsed into the `grid` object; `styles`
  declared in object form; `flags.hotReload` declared at the root of `flags`
  (not under the package namespace) and switched to the object form
  (`{ extensions, paths }`) that Foundry's runtime hot-reload watcher
  actually reads. The previous shape was a double no-op — wrong location AND
  wrong form, so the watcher silently exited without registering any
  extensions.

  Hot-reload enablement on the Foundry server side is deferred — runtime
  configuration changes interact with felddy's `CONTAINER_PRESERVE_CONFIG`
  flag in ways that require a dedicated design pass. That work is tracked
  separately and will land alongside the developer-facing hot-reload bridge.

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

  Plan deviation: the codegen runs as `postbuild` (not `prebuild`) so the
  script imports the just-built ESM directly instead of needing
  `tsx`/`unrun` to load the TS source. Documented inline in the codegen
  script.

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
