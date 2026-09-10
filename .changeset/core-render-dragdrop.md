---
"@vttforge/core": patch
---

`BaseActorSheet` and `BaseItemSheet` now declare `_onRender` as `async` and await the parent's render before binding the `DRAG_DROP` entries; a subclass that overrides it should `await super._onRender(context, options)`. The instances come from `foundry.applications.ux.DragDrop.implementation` when the runtime provides it. The JSDoc examples pass `{ inplace: false }` to `mergeObject`, which the parent's static options need.
