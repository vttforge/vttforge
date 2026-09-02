# @vttforge/vite-plugin

## 0.4.1

### Patch Changes

- 578ba31: Bring the package READMEs in line with what shipped. `core`, `styles`, `types` and `vite-plugin` still described themselves as v0.0.1 placeholders with "planned" features; `cli` did not mention `audit`.
- ae724e3: Read the exported `VTTFORGE_*_VERSION` constants from `package.json` at build time. They were hardcoded and had fallen behind — `vttforge --version` printed `0.1.0` on the 0.5 line.

## 0.4.0

### Minor Changes

- dc320a3: Keep class names through minification.
  
  Foundry reads class names at runtime, and a minifier does not promise the same one twice. The clearest case is a registered sheet: Foundry keys it by `${package id}.${class name}` and saves that key on every document using it, so a rename between builds orphans the reader's choice. `registerSheets` fixes the name for that case.
  
  Everything else stayed minified. A stack trace named `mo`. An `instanceof` error message named `t`. Someone debugging a sheet that renders nothing read a prototype chain of `go → r → HandlebarsApplication` and had to work out which of those was theirs.
  
  Builds now pass `keepNames` to rolldown, so a class reports the name it was written with.
  
  ## Upgrading moves your sheet keys, once
  
  This matters if you register sheets by hand — `Actors.registerSheet(id, MySheet, …)` rather than the `sheets` option on `registerSystem` / `registerModule`.
  
  Foundry derives the key from the class name, so this release changes it: a sheet that registered as `my-system.e` under 0.3.x registers as `my-system.CharacterSheet` under 0.4.0. Every `flags.core.sheetClass` already saved against the old key names a sheet that no longer exists, and Foundry falls back to the default without saying anything.
  
  That is the same failure the explicit sheet id exists to prevent, so **migrate before you upgrade**:
  
  ```ts
  registerSystem({
    id: 'my-system',
    sheets: [{ id: 'character', document: 'Actor', sheet: CharacterSheet, types: ['character'], makeDefault: true }],
  });
  ```
  
  With an explicit `id`, the key is written down rather than derived, and neither this release nor any later rename moves it. Ship that first, then take the plugin bump — otherwise the key jumps from one derived value to another and your readers lose their sheet in between.
  
  This complements the explicit sheet id rather than replacing it: a rename in your own source would still move a key that was inferred from a class name.

## 0.3.1

### Patch Changes

- 33793d8: First real release. Only a `0.0.0` name placeholder was on npm until now, and every scaffolded project depends on this package — so `vttforge init` produced a project that could not install.
  
  No code change; the version bump is what publishes it.

## 0.3.0

### Minor Changes

- 9462144: Require Node 26.

  The floor moves from `>=22.14.0` to `>=26.0.0` across every package and the
  four scaffolding templates, and the bundler target for the Node-side
  packages moves from `node22` to `node26`.

  Node 22 entered maintenance in October 2025 and receives security fixes
  only. Node 26 becomes the active LTS line on 2026-10-28.

  This is breaking for anyone on Node 22 or 24. It is marked `minor` rather
  than `major` on purpose: these packages are still on 0.x, where a minor
  signals the break, and a major would push every package to 1.0.0 — a claim
  of API stability that has not been audited, on packages two of which are
  still stubs.

  The templates move to the versions this release publishes. On 0.x a caret
  pins the minor, so their old ranges would not have matched.

  CI now pins Node through `actions/setup-node` instead of inheriting whatever
  the runner image ships, so the version the packages declare is the version
  they are tested on. It was not before: the workflow took the image's Node,
  and nothing enforced the declared floor because `engine-strict` is not set.

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
