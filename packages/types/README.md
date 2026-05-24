# @vttforge/types

Shared TypeScript types for VTTForge — full class-level `InferSchema<T>` and Foundry v13+ typing helpers (built on top of `fvtt-types`).

> **Status:** v0.0.1 placeholder. Real type surface lands in v1.0.0 — gated on `fvtt-types` v13 stabilisation.

## Planned scope (v1.0.0)

- Full `InferSchema<T>` including `EmbeddedDataField`, `EmbeddedDocumentField`, `TypedSchemaField`.
- Drizzle-style `$inferData` accessor on `BaseTypeDataModel`.
- `Prettify<T>` IDE perf helpers applied at every public boundary.
