---
"@vttforge/core": minor
---

Play and edit modes for the sheet bases. Opt in with `static MODES = { initial: 'play' }` on a `BaseActorSheet()` or `BaseItemSheet()`: a header control switches between the two, `sheet.mode`, `sheet.toggleMode()` and `context.mode` report it, the sheet element carries `vttforge-mode-play` or `vttforge-mode-edit`, and in play every form field in the window content is disabled except those inside an element with `data-vttforge-edit-in-play`. A sheet without `MODES` behaves as before.
