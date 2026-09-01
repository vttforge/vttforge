---
'@vttforge/core': minor
---

Type the three embedded fields, and turn `checkJs` back on for the example.

- `EmbeddedDataField` is the model instance, not a plain object — the field builds a schema from the model's own `defineSchema()`, but initializing constructs the model, so derived data and methods come with it.
- `EmbeddedDocumentField` is the same for a Document class, and nullable out of the box.
- `TypedSchemaField` is a discriminated union. The field supplies a `type` string validated to equal each entry's key when the entry does not declare one, which is what makes narrowing on `type` work.

The example system now compiles with `checkJs: true`, which is what proves any of this against real JavaScript rather than only against type tests.
