# @vttforge-examples/simple-system

Reference Foundry v14 system built on `@vttforge/core` + `@vttforge/styles`. It is also the end-to-end smoke test for everything VTTForge v0.1 ships.

> **Status:** v0.1.0. Runs inside Foundry v14+ with a real character and gear sheet, declarative migrations, and the full `VTTF-NNNN` error catalogue. Hook it up against `docker-compose.dev.yml` at the repo root.

## What this exercises

| @vttforge/core feature | Where it lives |
|---|---|
| `BaseTypeDataModel()` + `fields()` + `InferSchema<T>` | `scripts/data/character-data.mjs`, `scripts/data/gear-data.mjs` |
| `BaseActorSheet()` with `static TABS` + `static DRAG_DROP` + typed `onDropItem` | `scripts/sheets/character-sheet.mjs` |
| `BaseItemSheet()` mirror | `scripts/sheets/gear-sheet.mjs` |
| `registerSystem({ ..., onReady })` | `scripts/main.mjs` |
| `createMigrationRunner({ ..., compatibleVersion })` | `scripts/migrations.mjs` |
| `VttfError.docsUrl` resolution (PR 8) | catch block in `scripts/main.mjs` |

The Handlebars templates stick to the standard v14 idioms:
`<img data-edit="img">` for the portrait (DocumentSheetV2's built-in
`editImage` action), `<prose-mirror>` for rich text, `data-action="…"`
for click handlers, and `data-tab`/`data-group` for tab navigation.

## Run inside Foundry

The monorepo ships a `docker-compose.dev.yml` that mounts the built `dist/`
of this directory read-only into a `felddy/foundryvtt:14` container. From
the repo root:

```bash
cp .env.example .env                                  # fill in FOUNDRY_LICENSE_KEY + foundryvtt.com credentials
pnpm install                                          # one-time
pnpm -F @vttforge-examples/simple-system build        # bundles into examples/simple-system/dist/
docker compose -f docker-compose.dev.yml up           # → http://localhost:30000
```

`pnpm -F @vttforge-examples/simple-system dev` rebuilds on every source
change (a Foundry refresh picks up the new bundle).

Open <http://localhost:30000>, create a world using the **VTTForge Example
System**, then make a Character actor. The sheet renders with the abilities
tab active and takes a drop of any gear item from the sidebar. It turns down
other item types with `ui.notifications.warn`.

For the full contributor workflow see [`CONTRIBUTING.md`](../../CONTRIBUTING.md)
at the repo root.

## Layout

```
scripts/
├── data/
│   ├── character-data.mjs        ← TypeDataModel for `character`
│   └── gear-data.mjs             ← TypeDataModel for `gear`
├── sheets/
│   ├── character-sheet.mjs       ← BaseActorSheet subclass
│   └── gear-sheet.mjs            ← BaseItemSheet subclass
├── main.mjs                      ← registerSystem entry
└── migrations.mjs                ← createMigrationRunner registry

templates/
├── actor/character-sheet.hbs     ← tabs + abilities/inventory/biography
└── item/gear-sheet.hbs           ← details/description

tests/
└── boot.test.mjs                 ← happy-dom smoke: mocks Foundry, boots main.mjs

styles/example.css                ← @import '@vttforge/styles' + per-system rules
lang/en.json                      ← localisation strings (incl. TYPES.Actor.*, TYPES.Item.*)
system.json                       ← Foundry v14 manifest (id: vttforge-example)
```
