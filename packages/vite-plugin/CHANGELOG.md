# @vttforge/vite-plugin

## 0.2.0

### Minor Changes

- 50721f9: fix: align with Foundry v13 manifest schema and add `prepareBaseData` hook

  Three coordinated changes:

  **`@vttforge/core`** — `BaseTypeDataModel()` now ships a `prepareBaseData()`
  no-op stub alongside `prepareDerivedData()`. Use `prepareBaseData()` to
  initialize fields that Active Effects need to mutate (base max HP, base AC),
  since AEs apply between `prepareBaseData()` and `prepareDerivedData()`.
  `prepareDerivedData()` stays the place for values that depend on the
  AE-mutated state.

  The misleading `_addDataFieldMigrations()` static stub is removed. The real
  field-rename API is `_addDataFieldMigration(source, oldKey, newKey, apply?)`
  called inside a `static migrateData(source)` override — consumers who need
  it can call it directly on the Foundry-provided base via `super`.

  **`@vttforge/vite-plugin`** — emits the canonical v13 `styles` form
  (`[{ src: "styles/foo.css" }]`) in the built manifest. Still accepts the
  legacy string form (`["styles/foo.css"]`) and the v13 object form as input,
  so existing consumers don't need to change their source manifest. Additional
  metadata declared on object entries (e.g. `layer` for cascade layer
  placement) is preserved through the rewrite — only `src` is rewritten to
  point at the bundled output.

  **`@vttforge-examples/simple-system`** — manifest aligned with v13 schema:
  `gridDistance` / `gridUnits` collapsed into the `grid` object; `styles`
  declared in object form; `flags.hotReload` declared at the root of `flags`
  (not under the package namespace) and switched to the object form
  (`{ extensions, paths }`) that Foundry's runtime hot-reload watcher
  actually reads. The previous shape was a double no-op — wrong location AND
  wrong form, so the watcher silently exited without registering any
  extensions.

  Hot-reload enablement on the Foundry server side is deferred — runtime
  configuration changes interact with felddy's `CONTAINER_PRESERVE_CONFIG`
  flag in ways that require a dedicated design pass. That work is tracked
  separately and will land alongside the developer-facing hot-reload bridge.

- 4d34985: Move to Vite 8.

  The plugin's `vite` peer range now reads `^8.2.2`, so a project still on
  Vite 6 or 7 will not satisfy it. The four `vttforge init` templates move
  with it, which keeps a freshly scaffolded project free of a peer conflict.

  The plugin itself needed no code change — it uses only the `config` hook
  and the `Plugin` and `UserConfig` types, all unchanged across the two
  majors.

## 0.1.0

### Minor Changes

- e4e7609: feat(vite-plugin): MVP shipping the SDK build contract

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

## 0.0.1

Initial placeholder release — package name reserved on npm. Implementation lands in v0.2.0.
