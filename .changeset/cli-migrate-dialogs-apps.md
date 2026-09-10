---
"@vttforge/cli": minor
---

`vttforge migrate --sheets` covers the rest of Application v1: `new Dialog({...}).render(true)` becomes `DialogV2.wait({...})` with the buttons as a list and the callbacks on the `(event, button, dialog)` signature, `Dialog.prompt` becomes `DialogV2.prompt`, and a `FormApplication` or `Application` class gets its `.v2` file on `HandlebarsApplicationMixin(ApplicationV2)`, with `_updateObject` turned into the static form handler. What cannot be read stays as written with a `TODO(migrate)` line.
