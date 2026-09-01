---
'@vttforge/core': minor
---

Type `SetField` and `ForeignDocumentField` in `InferSchema`.

A `SetField` holds a `Set`, not an array. Inferring it as an array handed you `push` and index access on a value that has neither, and the compiler agreed.

A `ForeignDocumentField` reads back as the document itself — the data model installs the field as a getter, so the property gives you the instance, not the function that fetched it. Under `idOnly` it stays the id string. Both admit `null` unless the schema sets `nullable: false`.

Also exported: `SetFieldInstance`, `SetFieldCtor`, `SetFieldOptions`, `ForeignDocumentFieldInstance`, `ForeignDocumentFieldCtor`, `ForeignDocumentFieldOptions`, and `DocumentClass`.
