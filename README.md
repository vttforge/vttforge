<div align="center">

# 🔨 VTTForge

**A modern SDK and CLI for building [FoundryVTT](https://foundryvtt.com) v13+ systems and modules.**

[![npm version](https://img.shields.io/npm/v/@vttforge/core.svg?style=flat-square)](https://www.npmjs.com/package/@vttforge/core)
[![License](https://img.shields.io/npm/l/@vttforge/core.svg?style=flat-square)](LICENSE)
[![FoundryVTT](https://img.shields.io/badge/FoundryVTT-v13%2B-orange?style=flat-square)](https://foundryvtt.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.x-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org)

[📖 Documentation](#) · [🗺️ Roadmap](#roadmap) · [🐛 Report bug](https://github.com/vttforge/vttforge/issues)

</div>

---

> ⚠️ **Status:** Pre-release. `@vttforge/core` builds, typechecks, ships 100+ tests, and is validated end-to-end inside Foundry v13 via the bundled `examples/simple-system` (tabbed character sheet, drag-drop, migration runner). Not on npm yet — Trusted Publisher setup is pending. Watch this repo for the v0.1.0 release.

## Why VTTForge?

If you've built a FoundryVTT system, you've copy-pasted these:

```ts
// Every. Single. Sheet.
#createDragDropHandlers() { /* 36 lines of identical wiring */ }
async _prepareContext(options) {
  const context = await super._prepareContext(options);
  context.tabs = { primary: this._prepareTabs("primary"), ... };  // every group, every sheet
  return context;
}
async _onDropItem(event, data) {
  const item = await fromUuid(data.uuid);  // fromUuid ceremony in every sheet
  // …type-switching, validation, transfer logic
}
```

VTTForge replaces all of that with declarative APIs:

```ts
import { BaseActorSheet, fields, type InferSchema } from "@vttforge/core";

class CharacterSheet extends BaseActorSheet() {
  static PARTS = { /* your templates */ };
  static TABS  = { /* declared once; context.tabs[group] auto-filled in _prepareContext */ };
  static DRAG_DROP = [{ dragSelector: ".item[draggable=true]" }];

  // Typed drop sugar — fromUuid already done. Return undefined to fall through to Foundry's default.
  async onDropItem(item, event) { /* … */ }
}

// Same defineSchema() drives both runtime validation AND your TypeScript types.
class CharacterData extends BaseTypeDataModel() {
  static defineSchema() {
    const f = fields();
    return { level: new f.NumberField({ required: true, initial: 1 }) };
  }
}
type CharacterSystem = InferSchema<ReturnType<typeof CharacterData.defineSchema>>;
// → { level: number }
```

VTTForge eliminates **hundreds of lines of structural boilerplate** with zero functionality regression — validated against a real production FoundryVTT system before each API ships. Where Foundry already does something well (`editImage` from `DocumentSheetV2`, the `_getTabs()` state machine on ApplicationV2), we don't reinvent it.

## Packages

| Package | What it does | Status |
|---|---|---|
| [`@vttforge/core`](https://www.npmjs.com/package/@vttforge/core) | Runtime utilities: `BaseTypeDataModel`, `BaseActorSheet`, `BaseItemSheet`, `SystemConfig`, `registerSystem`, `fields()`, `InferSchema<T>`, `createMigrationRunner`, `getErrorManifest`, `VttfError` | 🚧 v0.1 in progress |
| `@vttforge/styles` | Base CSS layer: design tokens, sheet primitives, drag-drop affordances, opt-in themes (CSS Cascade Layers) | 🚧 v0.1 in progress |
| [`@vttforge/vite-plugin`](https://www.npmjs.com/package/@vttforge/vite-plugin) | Vite plugin: HMR for `.hbs`, CSS pipeline (PostCSS), manifest sync | 📋 v0.2 planned |
| [`@vttforge/cli`](https://www.npmjs.com/package/@vttforge/cli) | `vttforge init / dev / build` | 📋 v0.3 planned |
| [`@vttforge/testing`](https://www.npmjs.com/package/@vttforge/testing) | Quench helpers for system/module tests | 📋 v1.0 planned |
| [`@vttforge/types`](https://www.npmjs.com/package/@vttforge/types) | Shared TypeScript types | 📋 v1.0 planned |

## Try it today

The repo ships a working Foundry v13 system you can boot in one command. Requires Docker + a [foundryvtt.com](https://foundryvtt.com) license:

```bash
git clone https://github.com/vttforge/vttforge && cd vttforge
corepack enable && pnpm install
pnpm build                                       # builds @vttforge/core + bundles the example
cp .env.example .env                             # fill in FOUNDRY_LICENSE_KEY / USERNAME / PASSWORD
docker compose -f docker-compose.dev.yml up      # → http://localhost:30000
```

Inside Foundry: install **VTTForge Example System**, create a world, add a Character actor — the SDK-provided tabbed sheet renders with abilities/inventory/biography, drag-drop inventory, and the demo migration runs at world load.

## Quick start (v0.1.0)

> Coming with v0.1.0 once `@vttforge/cli` ships. The shape will look like this:

```bash
# Scaffold a new FoundryVTT system in TypeScript
npx @vttforge/cli init my-system --type system --lang ts

# Start the dev server with HMR for .hbs templates
cd my-system
vttforge dev --foundry-data ~/Library/Application\ Support/FoundryVTT/Data

# Production build
vttforge build
```

## Design principles

1. **Zero lock-in.** VTTForge outputs plain `.mjs` files that Foundry loads natively. You can drop VTTForge from your project at any time.
2. **Type-safe by default.** Full TypeScript declarations. Eventually, schema-to-type inference (Zod-style) so you stop double-typing your data models.
3. **Battle-tested.** Every API is validated against a real production FoundryVTT system before being shipped.
4. **Modern tooling.** pnpm 10+ with Corepack and catalogs, Turborepo, `tsdown` (Rolldown-based), Vite (consumer dev server), Biome (+ optional Oxlint), Changesets with npm OIDC trusted publishing, `publint` + `attw` + `knip` + `syncpack`, `lefthook`. The same stack the rest of the JS ecosystem uses in 2026.
5. **Community first.** MIT licensed. No paid tiers. Sponsor optional.

## Roadmap

- ✅ **v0.0** — Names reserved, repo created
- 🏗️ **v0.1** — `@vttforge/core` runtime + first reference migration
- 📦 **v0.2** — `@vttforge/vite-plugin` (HMR, manifest sync)
- 🛠️ **v0.3** — `@vttforge/cli` scaffolding
- 🚀 **v1.0** — Schema inference, decorators, stable API

## Contributing

VTTForge is in pre-release. The core API is being shaped against a real production system, so contributions are most useful as:

- **Reporting boilerplate patterns** in your own system/module that VTTForge could eliminate
- **Trying the v0.1 release** when it lands and giving feedback on rough edges
- **Documentation improvements** (always welcome)

Once the core API stabilizes in v1.0, we'll open up to broader code contributions. Read [CONTRIBUTING.md](./CONTRIBUTING.md) when it lands.

## License

[MIT](LICENSE) © Fabricio Cavalcante de Souza and contributors.

---

## Disclaimer

VTTForge is an independent, community-developed project. It is not affiliated with, endorsed by, or sponsored by Foundry Gaming LLC. "Foundry Virtual Tabletop", "Foundry VTT", and "FVTT" are trademarks of Foundry Gaming LLC.
