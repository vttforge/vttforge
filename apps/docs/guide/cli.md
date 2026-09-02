# CLI reference

```bash
pnpm create vttforge my-system        # or: npx @vttforge/cli init my-system
```

## `vttforge init`

```bash
vttforge init <name> [--type system|module] [--lang ts|js]
                     [--id <id>] [--title <t>] [--description <d>]
                     [--author <a>] [--license <spdx>]
                     [--yes] [--no-install] [--no-git]
```

Writes a runnable project into `<name>/` from one of four templates. It asks
for anything not passed; `--yes` takes the defaults instead, so the command
works in CI. The package manager that invoked it — `pnpm`, `npm`, `bun`,
`yarn` — is the one it installs with.

| Template | What you get |
|---|---|
| `system-ts` / `system-js` | One Actor type and one Item type on typed data models, a tabbed character sheet with drag-drop, a migration runner, a setting |
| `module-ts` / `module-js` | A `note` Item sub-type on `registerModule`, its sheet, an `@Note[id]` enricher, a setting, a public API |

The TypeScript templates typecheck against the published `@vttforge/core`
out of the box.

## `vttforge dev`

```bash
vttforge dev [--foundry-data <path>] [--port <n>]
```

Builds once, links `dist/` into Foundry's data directory, installs the
`@vttforge/dev-module` companion, and watches. See [the dev
loop](/guide/dev-loop) for what reloads in place.

The first run asks where Foundry keeps its data and saves the answer to
`.vttforge/config.json`. `--foundry-data` (alias `--data-dir`) or the
`FOUNDRY_DATA_DIR` variable overrides it. `--port` moves the hot-reload
bridge off `31313`.

## `vttforge build`

Runs the production build and writes `<id>-<version>.zip` at the project
root, manifest at the top level, which is what foundryvtt.com expects.
`LICENSE`, `README.md` and `CHANGELOG.md` go in when present.

The scaffold's release workflow runs this on every tag and attaches the zip
and the manifest to a GitHub Release.

## `vttforge audit`

```bash
vttforge audit [dir] [--json] [--strict]
```

Checks the manifest and the source against the v13 breakages that fail
quietly — nothing in the console, a feature that just does not work.

| Code | Severity | What it catches |
|---|---|---|
| `VTTF-AUDIT-001` | HIGH | `flags.hotReload` in the wrong shape — hot reload silently off |
| `VTTF-AUDIT-002` | MEDIUM | Top-level `gridDistance` / `gridUnits` — replaced by `grid` |
| `VTTF-AUDIT-003` | LOW | `styles` as an array of strings — the v12 shape |
| `VTTF-AUDIT-004` | MEDIUM | An `HTMLField` or `FilePathField` not listed in `documentTypes` — the server only sanitises declared paths |
| `VTTF-AUDIT-005` | MEDIUM | A `TypeDataModel` without `prepareBaseData` — Active Effects apply between it and `prepareDerivedData` |
| `VTTF-AUDIT-006` | LOW | An `_addDataFieldMigrations` override — the signature is not what it looks like |
| `VTTF-AUDIT-007` | MEDIUM | `primaryTokenAttribute` / `secondaryTokenAttribute` not pointing at a `{ value, max }` field — the token bar degrades with no error |

Rules 004 and 007 read the schema whether it is a `static defineSchema()` or
a function handed to `BaseTypeDataModel`, and scope it to the class
registered for that document.

The exit code is non-zero on a HIGH finding. `--strict` makes any finding
fail, for CI. `--json` prints the report as data.
