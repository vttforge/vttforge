# {{TITLE}}

{{DESCRIPTION}}

A Foundry VTT v14+ module built on [VTTForge](https://vttforge.dev). It adds a
`note` Item type to whatever system the world runs, a sheet for it, and an
`@Note[id]` enricher that links to one from any text field.

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

Then enable **{{TITLE}}** in a world and create a Note from the Items sidebar.

## What's inside

| Path | Purpose |
|---|---|
| `module.json` | Manifest. Declares the `note` sub-type under `documentTypes` and the hot-reload paths |
| `scripts/main.ts` | One `registerModule` call: data model, sheet, enricher, settings, API |
| `scripts/constants.ts` | `MODULE_ID` and `NOTE_TYPE`, the prefixed key Foundry files the sub-type under |
| `scripts/data/note-data.ts` | The data model. The schema is a function handed to `BaseTypeDataModel`, which makes `this.body` a `string` |
| `scripts/sheets/note-sheet.ts` | The sheet, on `BaseItemSheet` |
| `scripts/enricher.ts` | `@Note[id]` → a link that opens the note |
| `templates/` | Handlebars, using Foundry's own elements (`<prose-mirror>`, `data-action`) |
| `styles/main.css` | Scoped under `.{{ID}}`, colours from Foundry's variables |
| `lang/en.json` | Strings, under the `{{LOCALE_PREFIX}}` prefix, plus the `TYPES.Item` label |

## Before you edit

A module's sub-types are namespaced: you register `note`, Foundry files it as
`{{ID}}.note`, and the manifest must match. `registerModule` adds the prefix,
and `NOTE_TYPE` in `constants.ts` is the one place it is spelled out.

`registerModule({ sheets })` pins each sheet under `{{ID}}.<id>`, and Foundry
saves that key on every item whose owner picked the sheet. Without an
explicit id it derives the key from the class name, and a bundler renames
classes between builds. Keep the ids.

`this.document` is typed. The sheet hands its own schema to the base
(`BaseItemSheet<NoteItem>()`), so `document.system` is `NoteData` and nothing
casts.

## Public API

```ts
const api = game.modules.get("{{ID}}").api;
await api.createNote("Session 3", "<p>The party reached the gate.</p>");
api.noteType; // "{{ID}}.note"
```

## Checks

```bash
pnpm typecheck        # tsc against the real @vttforge/core types
pnpm lint             # Biome (shipped with the CLI) over the project, then the v14 audit
pnpm format           # the same, writing the safe fixes and formatting
npx vttforge audit    # the audit alone: manifest + source against the v14 list of quiet breakages
```

## Releasing

Push a tag and `.github/workflows/release.yml` builds, zips, and attaches
`{{ID}}-<version>.zip` plus `module.json` to a GitHub Release:

```bash
git tag v0.1.0
git push --tags
```

Point Foundry, and foundryvtt.com, at the release's
`latest/download/module.json`, so installs auto-update on every tag.

## License

{{LICENSE}} © {{YEAR}} {{AUTHOR}}
