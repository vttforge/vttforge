---
'@vttforge/core': minor
'@vttforge/vite-plugin': minor
'@vttforge-examples/simple-system': patch
---

fix: align with Foundry v13 manifest schema and add `prepareBaseData` hook

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
