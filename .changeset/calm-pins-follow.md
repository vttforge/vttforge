---
'@vttforge/cli': patch
---

Follow the `@vttforge/core` and `@vttforge/vite-plugin` minors in the scaffold's pins, so a new project gets the decorators and the build that lowers them.

On a `0.x` version a caret pins the minor, so the old pins would have kept new projects on the releases before them. The templates ship inside this package, so the corrected pins only reach anyone when the CLI is published too.
