---
"@vttforge/core": minor
"@vttforge-examples/simple-system": patch
---

Fix `BaseActorSheet` / `BaseItemSheet` tab handling so sheets work without
per-consumer workarounds.

Two issues surfaced when running the example sheet inside a live Foundry v13:

- **`context.tabs` double-wrap on single-group sheets.** The previous
  `_prepareContext` override unconditionally set `context.tabs[group]`,
  even when ApplicationV2 already populated a flat
  `context.tabs[tabId]` for single-group sheets. The collision forced
  consumers to either unwrap manually or write `context.tabs.<group>.<tabId>`
  in every template. Fixed: BaseActorSheet/BaseItemSheet now only fill
  `context.tabs[group]` for **multi-group** sheets (single-group sheets
  see ApplicationV2's flat shape untouched).

- **No default `tab`-style action handler.** ApplicationV2 doesn't ship a
  built-in handler for `data-action="…"` tab navigation buttons, and the
  bare name `tab` is reserved by the framework (custom handlers under that
  name never fire). Fixed: both base sheets now ship a `vttforgeTab`
  action that toggles `.active` on the matching nav button
  (`[data-action="vttforgeTab"][data-group=…][data-tab=…]`) and content
  section (`section.tab[data-group=…][data-tab=…]`) and updates
  `sheet.tabGroups[group]`. Templates that already used the old per-sheet
  workaround need to rename `data-action="tab"` → `data-action="vttforgeTab"`.

Discovered during development testing — not derived from any external
source.

Patch bump for the example: drops the `_prepareContext` unwrap workaround
and the per-sheet `_onTab` static handlers added in the previous PR,
since both now live in the SDK.
