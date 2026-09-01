---
'@vttforge/cli': patch
---

Point the templates at the core version this release publishes.

The `ColorField` and presence fixes take `@vttforge/core` to 0.6.0, and a
caret pins the minor on a 0.x version, so the templates' `^0.5.0` would not
have matched.
