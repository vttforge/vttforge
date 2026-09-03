---
"@vttforge/testing": patch
"@vttforge/cli": patch
---

Declare the Foundry globals with `var` so a consumer's own declarations can coexist. A package that adds `@vttforge/testing` to a typechecked project already declares `foundry`, `game`, `CONFIG`, `Hooks` and `ui` for its own source, and two `declare global` blocks only merge when both use `var`. With `const` on either side `tsc` stopped with `TS2451: Cannot redeclare block-scoped variable`, which is what a real consumer hit the first time it tried to typecheck its tests. The scaffolding templates are corrected the same way.
