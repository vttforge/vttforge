---
'@vttforge/cli': minor
---

The bare v13 global aliases (`renderTemplate`, `ActorSheet`, `Actors`, `TextEditor`, `ChatLog` and about ninety more) warn on v14 and throw on v15. `vttforge audit` reports them as `VTTF-AUDIT-019`, and `vttforge migrate` renames each to its `foundry.*` path, which is the same object. A name the file declares or imports, an object key, a property, and a word inside a string are left alone.
