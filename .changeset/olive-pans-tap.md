---
'@vttforge/cli': patch
---

Say which exports are supported, which are experimental, and which are internal.

This package's product is the `vttforge` binary, and its index had grown to re-export the pieces the commands are built from. 60 exports, of which 33 were reachable only by importing them directly. Nothing outside the package imports them.

They are now tagged where they are defined, so the tag reaches the published types and your editor shows it:

- **Supported**, under the deprecation policy: `runInit` and the audit surface (`runAudit`, `runManifestRules`, `runSourceRules`, `formatReport`, and the `RuleFn` / `RuleResult` / `Severity` types). `create-vttforge` calls `runInit`, and the audit rules are a deliberate extension point.
- **`@experimental`**: plausibly useful to a tool author, but nobody has asked, so the shape is a guess. Can change in a minor.
- **`@internal`**: implementation detail (`substitute`, `templatesRoot`, `configPath`, the symlink and Vite-spawning helpers, and the rest). They keep working until the next major, and importing one is not supported today.

Nothing is removed and no signature changed. If you are importing something tagged `@internal` and it is the only way to do what you need, open an issue.

The other four packages came out clean: every export in `core`, `testing`, `vite-plugin` and `types` is reachable through the documented API.
