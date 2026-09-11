---
"@vttforge/cli": patch
---

Audit rule 007 reads `resourceField()` from `@vttforge/core` as a `{ value, max }` field, at the top level or nested in a SchemaField, so a system using it is not flagged. The scaffold templates pin `@vttforge/core` at the version this release publishes.
