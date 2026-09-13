---
'@vttforge/testing': minor
---

`MockFoundry` gained two members, `menus` and `keybindings`, so a hand-written
stand-in for that interface no longer satisfies it. Add them, or type the
stand-in as a partial.

The mock was behind the types it ships beside. `@vttforge/types` describes
`game.settings.settings`, `game.settings.registerMenu` and `game.keybindings`,
so code calling them compiled and then threw under the mock. A module that
registers a settings menu could not be loaded in a unit test at all.

`withMockFoundry` now files every registered setting in `game.settings.settings`,
keyed `namespace.key`, and normalises as it stores the way registration does: an
unknown scope falls back to `client`, a missing default becomes `null`. Menus go
to `game.settings.menus` through `registerMenu`, and `game.keybindings.register`
records what a package binds. The handle exposes `menus` and `keybindings`
beside `settings`.

That registry is the only way to reach a setting belonging to a package you did
not write, which is what anything that enumerates, reports on or copies a world
needs.
