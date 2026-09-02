---
'@vttforge/cli': patch
---

Templates pin `@vttforge/core@^0.11.0`.

The base classes stopped carrying an index signature in that release, so a project scaffolded against an older core would not see the errors the new typing exists to raise.
