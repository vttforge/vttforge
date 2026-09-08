---
'@vttforge/core': minor
---

`@SystemSetting`, the last of the planned decorators. Put it on a static accessor and the setting is registered at `init`; reading the accessor calls `game.settings.get`, assigning to it calls `game.settings.set`, and the accessor's initializer is the default. Experimental, like the other four.
