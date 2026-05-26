---
'@vttforge/vite-plugin': minor
'@vttforge-examples/simple-system': patch
---

feat(vite-plugin): MVP shipping the SDK build contract

`@vttforge/vite-plugin` now ships its first real implementation. The default
export is a Vite plugin that takes a Foundry v13+ system or module source
tree and emits a fully Foundry-loadable `dist/` artifact:

- bundled browser-ESM entry at `dist/main.mjs` (no hashing) with every
  `@vttforge/*` import resolved at build time
- bundled CSS at `dist/styles/<name>.css` with bare specifiers like
  `@import "@vttforge/styles"` inlined
- manifest (`system.json` / `module.json`) copied to `dist/` with
  `version` synced from `package.json` and `esmodules` / `styles`
  rewritten to the bundled output paths
- `template.json`, `lang/`, `templates/` copied verbatim

`examples/simple-system` switches off the bespoke `tsdown` config and
consumes the plugin instead. Same end result, no inline-tokens workaround,
no manual bundle bookkeeping. `docker-compose.dev.yml` mounts
`examples/simple-system/dist/` so the deployable layout matches what real
consumers will ship.
