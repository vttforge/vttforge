---
"@vttforge/cli": patch
---

Fixes found by running `vttforge migrate` end to end on a v13 system: `--data-models` now spreads a `base` template when the file defines one; `--sheets` awaits the `super._prepareContext` it writes for a sync `getData`, drops `{ async: false }` from `enrichHTML` and awaits the call, and moves a `new Dialog` opened from a render listener to `DialogV2` like one opened from a click. Audit rule 007 accepts a `{ value, max }` field declared in a shared schema fragment. The note about a root `<form>` now says to make it a `<div>`, since a part has to render one element.
