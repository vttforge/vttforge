# @vttforge/cli

Scaffold, dev loop, release build and audit for Foundry VTT v13+ systems and modules.

```bash
pnpm create vttforge my-system        # same as: npx @vttforge/cli init my-system
```

## Commands

```bash
vttforge init <name> [--type system|module] [--lang ts|js] [--id] [--title] [--description]
                     [--author] [--license] [--yes] [--no-install] [--no-git]
vttforge dev   [--foundry-data <path>] [--port <n>]
vttforge build
vttforge audit [dir] [--json] [--strict]
```

**`init`** writes a runnable system or module into `<name>/` from one of four templates (`system-ts`, `system-js`, `module-ts`, `module-js`). It asks for what you did not pass, or takes defaults with `--yes`, so it works in CI. It detects the package manager that invoked it (`pnpm`, `npm`, `bun`, `yarn`), installs, and runs `git init`.

**`dev`** builds once, links `dist/` into Foundry's data directory under `Data/<systems|modules>/<id>/`, installs the `@vttforge/dev-module` companion, and watches. Save a template and the open sheet redraws in place; save a stylesheet and the CSS swaps. The first run asks where Foundry keeps its data and saves the answer to `.vttforge/config.json`; `--foundry-data` or `FOUNDRY_DATA_DIR` overrides it. If Foundry runs in a container it cannot follow the symlink, and the command prints the compose mount to use instead.

**`build`** runs the production build and writes `<id>-<version>.zip` at the project root with the manifest at the top level, which is what foundryvtt.com expects. `LICENSE`, `README.md` and `CHANGELOG.md` go in when present.

**`audit`** checks the manifest, the source and the templates against ten v13 breakages that fail quietly: the `flags.hotReload` shape, deprecated grid fields, the v12 `styles` shape, `HTMLField`/`FilePathField` paths missing from `documentTypes`, `TypeDataModel` without `prepareBaseData`, a bad `_addDataFieldMigrations` override, token attributes that do not point at a `{ value, max }` field, a sheet template that opens a `<form>` the sheet already is, a declared subtype with no name in any language file, and a `template.json` that erases the metadata `system.json` declares for the same type. `--json` for machines; `--strict` exits non-zero on any finding rather than only on HIGH.

## As a library

Every command is exported for tooling built on top: `runInit`, `runDev`, `runBuild`, `runAudit`, `emitReleaseZip`, `resolveFoundryDataDir`, `readManifest`, and the scaffold helpers.

## Docs

- [Getting started](https://vttforge.dev/docs/guide/getting-started)
- [The dev loop](https://vttforge.dev/docs/guide/dev-loop)
- [CLI reference](https://vttforge.dev/docs/guide/cli)

Node 26+.
