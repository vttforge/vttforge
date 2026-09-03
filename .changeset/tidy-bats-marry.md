---
'@vttforge/cli': patch
---

Follow the `@vttforge/styles` minor in the scaffold's pin.

On a `0.x` version a caret pins the minor, so `^0.3.0` would have kept new projects on the old styles. The templates ship inside this package, so the corrected pin only reaches anyone when the CLI is published too.
