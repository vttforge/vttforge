---
"@vttforge/core": minor
---

`resourceField(options)` builds the `{ value, max }` SchemaField a token bar reads, with both children required, non-nullable numbers, typed as `{ value: number; max: number }`. `registerSystem` now checks the manifest's `primaryTokenAttribute` and `secondaryTokenAttribute` against the Actor data models it registers and throws VTTF-0010 at `init` when no model declares a resource at that path; Foundry would draw no bar and say nothing. `schemaHasResource(schema, path)` is the check on its own.
