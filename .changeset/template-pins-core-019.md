---
"@vttforge/cli": patch
---

Point the scaffold templates at `@vttforge/core` 0.19, and use the document
types it ships. The TypeScript templates no longer hand-write an interface for
their own actor or item: they pass the schema to the sheet factory
(`BaseActorSheet<CharacterActor>()`) and read `this.document` straight.
