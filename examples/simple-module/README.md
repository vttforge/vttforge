# @vttforge-examples/simple-module

Reference Foundry v13 module built on `@vttforge/core` and `@vttforge/vite-plugin`. It is the `module-js` template from `vttforge init`, rendered with the id `vttforge-example-module`, plus a boot test.

## What this exercises

| Feature | Where |
|---|---|
| `registerModule` — sub-type, sheet, enricher, settings, API in one call | `scripts/main.mjs` |
| `moduleSubType` — the `<module id>.<type>` key Foundry files a module's sub-type under | `scripts/constants.mjs` |
| `BaseTypeDataModel(defineSchema)` | `scripts/data/note-data.mjs` |
| `BaseItemSheet()` with one part and one action | `scripts/sheets/note-sheet.mjs` |
| An enricher declared as data, with `onRender` | `scripts/enricher.mjs` |
| `documentTypes` in a module manifest | `module.json` |

## Run inside Foundry

From the repo root:

```bash
cp .env.example .env                                  # FOUNDRY_LICENSE_KEY + foundryvtt.com credentials
pnpm -F @vttforge-examples/simple-module build        # → examples/simple-module/dist/
docker compose -f docker-compose.dev.yml up           # → http://localhost:30000
```

Enable **VTTForge Example Module** in any world. Create a Note from the Items sidebar, copy the `@Note[id]` reference from its sheet, and paste it into any text field.

`pnpm -F @vttforge-examples/simple-module dev` rebuilds on every edit.

## Layout

```
scripts/
├── constants.mjs                 ← MODULE_ID, NOTE_TYPE
├── data/note-data.mjs            ← TypeDataModel for `note`
├── sheets/note-sheet.mjs         ← BaseItemSheet subclass
├── enricher.mjs                  ← @Note[id]
└── main.mjs                      ← registerModule entry
templates/item/note-sheet.hbs
tests/boot.test.mjs               ← happy-dom smoke: mocks Foundry, boots main.mjs
styles/main.css
lang/en.json
module.json
```
