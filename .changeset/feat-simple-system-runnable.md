---
"@vttforge-examples/simple-system": minor
---

`examples/simple-system` is now a real, runnable Foundry v13 system.

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
