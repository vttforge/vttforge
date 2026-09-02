# {{TITLE}}

{{DESCRIPTION}}

A Foundry VTT v13+ system built on [VTTForge](https://vttforge.dev): typed
data models, sheet bases that already know their tabs and drops, a migration
runner, and a build that produces what foundryvtt.com expects.

## Quick start

```bash
pnpm install
pnpm dev      # build, link dist/ into Foundry's data dir, watch
pnpm build    # dist/ plus {{ID}}-<version>.zip
```

`pnpm dev` asks where Foundry keeps its data on the first run and remembers
the answer in `.vttforge/config.json`. Override with `--foundry-data <path>`
or `FOUNDRY_DATA_DIR`. If Foundry runs in a container it cannot follow the
symlink, and the command prints the compose mount to use instead.

Save a template and the open sheet redraws in place; save a stylesheet and the
CSS swaps. Enable **VTTForge Dev** in the world once; `pnpm dev` links it in.

Then create a world on **{{TITLE}}** and open a character.

## What's inside

| Path | Purpose |
|---|---|
| `system.json` | Manifest: types, `htmlFields`, hot-reload paths, migration flags |
| `template.json` | The type names Foundry expects to see declared |
| `scripts/main.ts` | One `registerSystem` call: models, sheets, initiative, settings, migrations |
| `scripts/data/*.ts` | Data models. The schema is a function handed to `BaseTypeDataModel`, which is what makes `this.level` a `number` |
| `scripts/sheets/*.ts` | Sheets on `BaseActorSheet` / `BaseItemSheet`: `static TABS`, `static DRAG_DROP`, typed `onDropItem` |
| `scripts/migrations.ts` | `createMigrationRunner`: versioned, idempotent, GM-gated |
| `templates/` | Handlebars, using v13's own elements (`<prose-mirror>`, `data-action`) |
| `styles/main.css` | Imports `@vttforge/styles` and scopes your rules under `.{{ID}}` |
| `lang/en.json` | Strings, under the `{{LOCALE_PREFIX}}` prefix |

## Two things worth knowing before you edit

**Sheets are registered by id, not by class name.** `registerSystem({ sheets })`
pins each sheet under `{{ID}}.<id>`. Foundry saves that key on every actor
whose owner picked the sheet, and derives it from the class name unless told
otherwise, and a bundler renames classes between builds. Keep the ids; renaming one
loses the sheet choice on every document already using it.

**`this.document` is `unknown` on the sheet bases.** Which document a sheet is
for is yours to know. Each sheet here narrows it once in a getter (`actor`,
`item`) and everything below reads typed.

## Checks

```bash
pnpm typecheck        # tsc against the real @vttforge/core types
npx vttforge audit    # manifest + source against the v13 list of quiet breakages
```

## Releasing

Push a tag and `.github/workflows/release.yml` builds, zips, and attaches
`{{ID}}-<version>.zip` plus `system.json` to a GitHub Release:

```bash
git tag v0.1.0
git push --tags
```

Point Foundry, and foundryvtt.com, at the release's
`latest/download/system.json`, so installs auto-update on every tag.

## License

{{LICENSE}} © {{YEAR}} {{AUTHOR}}
