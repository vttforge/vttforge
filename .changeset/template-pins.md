---
'@vttforge/cli': patch
---

Point the scaffolding templates at the versions this release publishes.

The templates asked for `@vttforge/core@^0.3.0` and
`@vttforge/vite-plugin@^0.1.0`. On a 0.x version a caret pins the minor, so
`^0.3.0` means `>=0.3.0 <0.4.0` — and this release takes core to 0.4.0 and
the plugin to 0.2.0. Left alone, every project scaffolded after the release
would ask for versions the release had just superseded.
