# @vttforge/cli

Scaffold, dev loop, release build, lint and audit for Foundry VTT v14+ systems and modules.

```bash
pnpm create vttforge my-system        # same as: npx @vttforge/cli init my-system
```

## Commands

```bash
vttforge init <name> [--type system|module] [--lang ts|js] [--id] [--title] [--description]
                     [--author] [--license] [--yes] [--no-install] [--no-git]
vttforge dev   [--foundry-data <path>] [--port <n>]
vttforge build
vttforge lint  [dir] [--fix] [--no-audit] [--strict]
vttforge audit [dir] [--json] [--strict]
vttforge migrate [dir] [--write] [--strict] [--json] [--data-models] [--sheets]
```

**`init`** writes a runnable system or module into `<name>/` from one of four templates (`system-ts`, `system-js`, `module-ts`, `module-js`). It asks for what you did not pass, or takes defaults with `--yes`, so it works in CI. It detects the package manager that invoked it (`pnpm`, `npm`, `bun`, `yarn`), installs, and runs `git init`.

**`dev`** builds once, links `dist/` into Foundry's data directory under `Data/<systems|modules>/<id>/`, installs the `@vttforge/dev-module` companion, and watches. A saved template redraws the open sheet in place, and a saved stylesheet swaps the CSS. The first run asks where Foundry keeps its data and saves the answer to `.vttforge/config.json`; `--foundry-data` or `FOUNDRY_DATA_DIR` overrides it. If Foundry runs in a container it cannot follow the symlink, and the command prints the compose mount to use instead.

**`build`** runs the production build and writes `<id>-<version>.zip` at the project root, with the manifest at the top level where foundryvtt.com expects it. `LICENSE`, `README.md` and `CHANGELOG.md` go in when present.

**`lint`** runs Biome, which ships with the CLI, over the project with a shipped config (a `biome.json` at the project root replaces it), then the audit. `--fix` writes the safe fixes and formats.

**`audit`** checks the manifest, the source and the templates against the v14 breakages that fail quietly: the `flags.hotReload` shape, the removed grid fields, the v12 `styles` shape, `HTMLField`/`FilePathField` paths missing from `documentTypes`, `TypeDataModel` without `prepareBaseData`, a bad `_addDataFieldMigrations` override, token attributes that do not point at a `{ value, max }` field, a sheet template that opens a `<form>` the sheet already is, a declared subtype with no name in any language file, a `template.json` that erases the metadata `system.json` declares for the same type, and the v13 code v14 broke or deprecated: bare `mergeObject`-style globals, `-=` update keys, `rollMode`, whole-array `CONFIG.statusEffects` assignment, `legacyTransferral`, numeric Active Effect modes, a release workflow that zips the checkout of a project that builds to `dist/`, a template that still calls `{{#select}}` or `{{colorPicker}}`, and source that talks on the package socket channel while the manifest has no `"socket": true`. `--json` prints the findings as JSON, and `--strict` exits non-zero on any finding rather than only on HIGH.

**`migrate`** rewrites a v13 project for v14: the removed globals, `-=` keys, `rollMode`, context-menu keys, numeric effect modes, whole-array `CONFIG.statusEffects`, `legacyTransferral`, the core-sheet unregister lines, and the manifest's `type` and `compatibility`. It reports by default, writes with `--write` (every file computed before the first write), lists the changes it will not decide for you, and with `--strict` exits 1 while any is left. `--data-models` writes a data model per `template.json` type; `--sheets` writes a V2 sheet file on the SDK bases next to each Application v1 sheet class, with the `data-action` attributes its templates need.

## As a library

Every command is exported for tooling built on top: `runInit`, `runDev`, `runBuild`, `runAudit`, `emitReleaseZip`, `resolveFoundryDataDir`, `readManifest`, and the scaffold helpers.

## Docs

- [Getting started](https://vttforge.dev/docs/guide/getting-started)
- [The dev loop](https://vttforge.dev/docs/guide/dev-loop)
- [CLI reference](https://vttforge.dev/docs/guide/cli)

Node 26+.
