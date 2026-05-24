---
"@vttforge/core": minor
---

Add `fields()` factory and `InferSchema<T>` for typed `defineSchema()` outputs.

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
