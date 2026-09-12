---
"@vttforge/core": patch
---

`schemaHasResource` declared its first parameter as `Record<string, FieldInstance> | unknown`. A union with `unknown` is `unknown`, so the typed half did nothing and a caller got no checking from it. The parameter now says `unknown`, which is what it always was. No call changes.
