---
"@vttforge/core": minor
---

Extend `BaseActorSheet` and add `BaseItemSheet` — the boilerplate every shipping
system copy-pastes is now hoisted into the SDK.

- `static DRAG_DROP` — declare drag sources / drop targets as data; the base
  wires real `foundry.applications.ux.DragDrop` instances in `_onRender` with
  `isEditable`-gated permissions and a default `_onDragStart` that serialises
  `data-item-id` elements as `{ type: "Item", uuid }`.
- `_prepareContext` auto-fills `context.tabs[group]` for every group declared
  in ApplicationV2's `static TABS`, eliminating manual `_prepareTabs(group)`
  calls in subclass `_prepareContext`.
- Typed drop dispatch: override `onDropItem(item, event)` / `onDropActor(...)` /
  `onDropFolder(...)` / `onDropActiveEffect(...)` and skip the `fromUuid()`
  ceremony. Returning `undefined` falls through to Foundry's default
  `_onDropX`; return anything else to take ownership.
- New `BaseItemSheet()` mirror with the same `static DRAG_DROP` + tab
  auto-population, minus the drop dispatch (items rarely receive drops).
- Exports new `DragDropConfig` type for typed `static DRAG_DROP` declarations.

`editImage` is intentionally not reinvented — it already ships on
`DocumentSheetV2` (inherited by both `ActorSheetV2` and `ItemSheetV2`).
Templates wire `<img data-edit="img">` and Foundry's built-in action handles
the `FilePicker` flow.
