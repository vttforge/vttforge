# {{TITLE}}

{{DESCRIPTION}}

A Foundry VTT v14+ system built on [VTTForge](https://vttforge.dev): typed
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

A saved template redraws the open sheet in place, and a saved stylesheet swaps
the CSS. Enable **VTTForge Dev** in the world once; `pnpm dev` links it in.

Then create a world on **{{TITLE}}** and open a character.

## What's inside

| Path | Purpose |
|---|---|
| `system.json` | Manifest: types, `htmlFields`, hot-reload paths, migration flags |
| `scripts/main.ts` | One `registerSystem` call: models, sheets, initiative, settings, migrations |
| `scripts/data/*.ts` | Data models. The schema is a function handed to `BaseTypeDataModel`, which makes `this.level` a `number` |
| `scripts/sheets/*.ts` | Sheets on `BaseActorSheet` / `BaseItemSheet`: `static TABS`, `static DRAG_DROP`, typed `onDropItem` |
| `scripts/migrations.ts` | `createMigrationRunner`: versioned, idempotent, GM-gated |
| `templates/` | Handlebars, using Foundry's own elements (`<prose-mirror>`, `data-action`) |
| `styles/main.css` | Imports `@vttforge/styles` and scopes your rules under `.{{ID}}` |
| `lang/en.json` | Strings, under the `{{LOCALE_PREFIX}}` prefix |

## Before you edit

`registerSystem({ sheets })` pins each sheet under `{{ID}}.<id>`, and Foundry
saves that key on every actor whose owner picked the sheet. Without an
explicit id it derives the key from the class name, and a bundler renames
classes between builds. Renaming an id loses the sheet choice on every
document already using it.

`this.document` is typed. Each sheet here hands its own schema to the base
(`BaseActorSheet<CharacterActor>()`), so `document.system` is `CharacterData`
and nothing casts.

## Checks

```bash
pnpm typecheck        # tsc against the real @vttforge/core types
pnpm lint             # Biome (shipped with the CLI) over the project, then the v14 audit
pnpm format           # the same, writing the safe fixes and formatting
npx vttforge audit    # the audit alone: manifest + source against the v14 list of quiet breakages
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
