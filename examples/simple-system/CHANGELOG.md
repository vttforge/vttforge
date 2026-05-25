# @vttforge-examples/simple-system

## 0.1.0

### Minor Changes

- 3e51346: `examples/simple-system` is now a real, runnable Foundry v13 system.

  End-to-end smoke for everything `@vttforge/core` ships in v0.1:

  - `BaseTypeDataModel()` + `fields()` driving `CharacterData` (level, abilities,
    health, power, biography) and `GearData` (quantity, weight, description).
    `prepareDerivedData()` computes ability mods + max HP + armor class.
  - `BaseActorSheet()` driving `CharacterSheet` — `static TABS` for
    abilities/inventory/biography (with `context.tabs.primary` auto-populated),
    `static DRAG_DROP` wiring drag sources + drop targets, typed `onDropItem`
    accepting only `gear` items and rejecting others with a notification.
  - `BaseItemSheet()` driving `GearSheet` — details + description tabs.
  - `createMigrationRunner({ compatibleVersion: '0.0.0' })` with one
    `0.1.0 — rename character.bio → character.biography` migration, registered
    in `onAfterInit` and run in `onReady` (GM-gated).
  - `VttfError.docsUrl` caught and surfaced via `ui.notifications.error` so the
    PR 8 doc links are exercised end-to-end.

  Run inside Foundry via `docker-compose.dev.yml` at the repo root:
  `cp .env.example .env && docker compose -f docker-compose.dev.yml up`.

  New integration smoke (`tests/boot.test.mjs`) boots `scripts/main.mjs` against
  fully mocked Foundry globals and asserts the whole pipeline lands without
  throwing — catches integration drift before manual Foundry testing.

### Patch Changes

- a152969: Make `examples/simple-system` actually render inside Foundry v13:

  - **Bundle the entry with tsdown** (`dist/main.mjs`). Browsers can't resolve
    bare specifiers like `@vttforge/core`, and Foundry serves system files as
    static assets — so the entry point has to be self-contained. This is what
    `@vttforge/vite-plugin` will own in v0.2; we pre-empt it locally.
  - `system.json` now points to `dist/main.mjs`.
  - **Template/CSS fixes** discovered while testing the SDK against a live
    Foundry runtime:
    - Templates iterate `tabs` directly (ApplicationV2's single-group
      `_prepareTabs` output is keyed by tab id; nested `tabs.<group>.<tabId>`
      is only for multi-group sheets).
    - Tab nav uses `<button type="button">`; `<a>` without `href` doesn't
      trigger ApplicationV2's pointer-event delegation.
    - Each sheet ships its own `tab` action handler that toggles the `.active`
      class on the matching nav button and content section. (The SDK should
      hoist this; tracked as a follow-up.)
    - Opaque sheet background — without it Foundry's default leaves the
      canvas bleeding through.
  - **Compose**: drop the `user:` override and pin `user: "0:0"` so felddy can
    chown the named volume on first boot; the previous override blocked the
    install with `EACCES: permission denied`. `.env.example` updated to
    match — no more UID/GID knobs needed.
  - **Temporary `_prepareContext` workaround** in both sheets unwraps the
    single-group `context.tabs.primary` that `BaseActorSheet._prepareContext`
    adds today. The SDK fix removes the need for this — a follow-up PR makes
    the auto-wrap fire only for multi-group sheets.

  No `@vttforge/core` change.

- 49a8718: Fix `BaseActorSheet` / `BaseItemSheet` tab handling so sheets work without
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

- Updated dependencies [234a4b2]
- Updated dependencies [4fd5a07]
- Updated dependencies [0896bb0]
- Updated dependencies [49a8718]
  - @vttforge/core@0.3.0

## 0.0.2

### Patch Changes

- Updated dependencies [5dd98c1]
  - @vttforge/core@0.2.0

## 0.0.1

### Patch Changes

- Updated dependencies [4900e83]
  - @vttforge/core@0.1.0
  - @vttforge/styles@0.1.0
