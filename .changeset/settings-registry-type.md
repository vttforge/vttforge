---
'@vttforge/types': minor
---

`game.settings.settings` is typed. It is the map of every setting the world
registered, keyed `namespace.key`, and the only way to reach settings that
belong to a package you did not write. Read it to enumerate, report on or copy
what a world holds.

**Breaking:** `settings` is required on `GameSettingsApi`. Code that builds a
settings object by hand, which in practice means a test fake, no longer
compiles without it. Add `settings: new Map()` to the fake.

The new `RegisteredSetting` type is `SettingConfig` plus the `id`, `namespace`
and `key` that registration fills in.
