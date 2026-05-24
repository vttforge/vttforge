# @vttforge/core

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

  Both packages have working consumer entrypoints (verified by an external smoke test loading the built `.mjs` from a throwaway dir) and the SDK contracts match the `/foundry-vtt-system-dev` skill (TypeDataModel pitfalls, ActorSheetV2 + HandlebarsApplicationMixin, staged init hooks, marker classes).

  Status remains pre-1.0 and APIs are explicitly unstable — these are the first releases that have real code instead of placeholder `export {}`.

## 0.0.1

Initial functional release (v0.1 MVP slice). Foundry v13+ system runtime helpers, designed around the `/foundry-vtt-system-dev` and `/foundry-vtt-module-dev` API contracts.

### Added

- `registerSystem({ id, actorDataModels, itemDataModels, actorDocumentClass, itemDocumentClass, combat, statusEffects, onBeforeInit, onAfterInit })` — one-call boot that schedules CONFIG mutations via `Hooks.once("init", ...)`. Idempotent per `id` (throws `VTTF-0001` on duplicate). Sets `CONFIG.ActiveEffect.legacyTransferral = false` by default.
- `SystemConfig` — typed wrapper around `game.settings.register/get/set`. Tracks registered keys locally; reads/writes against an unregistered key throw `VTTF-0003` instead of returning `undefined`.
- `BaseTypeDataModel()` — mixin over `foundry.abstract.TypeDataModel` providing a safe default `migrateData` that delegates to `super` (foundry-vtt-system-dev pitfall #8), a stub `_addDataFieldMigrations`, and a no-op `prepareDerivedData`.
- `BaseActorSheet()` — mixin over `HandlebarsApplicationMixin(foundry.applications.sheets.ActorSheetV2)` with `DEFAULT_OPTIONS` that ship the `vttforge` marker class (foundry-vtt-system-dev "Styling" rule #2).
- `VttfError` + `VTTF-NNNN` registry — central, append-only error codes (`VTTF-0001` SystemAlreadyRegistered, `VTTF-0002` MissingFoundryGlobals, `VTTF-0003` UnknownSetting), each with a `name`, `summary`, and `docsUrl` pointing at `https://vttforge.dev/errors/VTTF-NNNN`. Supports native ES2022 `cause` and `AggregateError`.

### Verified

- 32 Vitest unit tests across 5 files, all passing on Node 22.14 and Node 24.
- External consumer smoke test (importing the published `.mjs` from a throwaway dir) confirms every exported symbol behaves as designed when Foundry globals are present or absent.
