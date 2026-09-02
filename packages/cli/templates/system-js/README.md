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
CSS swaps. Enable **VTTForge Dev** in the world once — `pnpm dev` links it in.

Then create a world on **{{TITLE}}** and open a character.

## What's inside

| Path | Purpose |
|---|---|
| `system.json` | Manifest — types, `htmlFields`, hot-reload paths, migration flags |
| `template.json` | The type names Foundry expects to see declared |
| `scripts/main.mjs` | One `registerSystem` call: models, sheets, initiative, settings, migrations |
| `scripts/data/*.mjs` | Data models. The schema is a function handed to `BaseTypeDataModel`, which is what keeps the schema in one place |
| `scripts/sheets/*.mjs` | Sheets on `BaseActorSheet` / `BaseItemSheet` — `static TABS`, `static DRAG_DROP`, `onDropItem` |
| `scripts/migrations.mjs` | `createMigrationRunner` — versioned, idempotent, GM-gated |
| `templates/` | Handlebars, using v13's own elements (`<prose-mirror>`, `data-action`) |
| `styles/main.css` | Imports `@vttforge/styles` and scopes your rules under `.{{ID}}` |
| `lang/en.json` | Strings, under the `{{LOCALE_PREFIX}}` prefix |

## Two things worth knowing before you edit

**Sheets are registered by id, not by class name.** `registerSystem({ sheets })`
pins each sheet under `{{ID}}.<id>`. Foundry saves that key on every actor
whose owner picked the sheet, and derives it from the class name unless told
otherwise — which a bundler renames between builds. Keep the ids; renaming one
loses the sheet choice on every document already using it.

**Derived values live in the schema.** `mod` on each ability is computed in
`prepareDerivedData`, but it is declared as a field. JavaScript has no
`declare`: a plain class field would emit and reset the property to
`undefined` after every data preparation.

## Checks

```bash
npx vttforge audit    # manifest + source against the v13 list of quiet breakages
```

## Releasing

Push a tag and `.github/workflows/release.yml` builds, zips, and attaches
`{{ID}}-<version>.zip` plus `system.json` to a GitHub Release:

```bash
git tag v0.1.0
git push --tags
```

Point Foundry — and foundryvtt.com — at the release's
`latest/download/system.json`, so installs auto-update on every tag.

## License

{{LICENSE}} © {{YEAR}} {{AUTHOR}}
