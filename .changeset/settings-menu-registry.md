---
'@vttforge/types': minor
---

`GameSettingsApi` gained `menus`, so a hand-written stand-in for that interface
no longer compiles. Add `menus: new Map()`, or type the stand-in as a partial.

Foundry keeps registered settings menus in `game.settings.menus`, keyed
`namespace.key`, the same shape as `game.settings.settings`. The interface
described the settings registry and not the menu one, so code reading it had to
cast. `RegisteredSettingMenu` is the entry type.
