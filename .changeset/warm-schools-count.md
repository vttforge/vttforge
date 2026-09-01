---
'@vttforge/core': minor
---

Type the statics on `BaseActorSheet()` and `BaseItemSheet()`.

Both returned a bare constructor, so a subclass writing `super.DEFAULT_OPTIONS` — the pattern the docs show and every sheet needs — failed to compile. TypeScript cannot see a static through an untyped constructor. The example system is JavaScript, so nothing caught it.

They now return `SheetBaseCtor`, which carries `DEFAULT_OPTIONS` and `DRAG_DROP`. A subclass declaring either needs the `override` modifier, which is TypeScript correctly seeing the inherited static.
