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

> ⚠️ **Status:** Pre-release. The full v0.1 surface is shipped on `main` and validated end-to-end inside Foundry v13+. `@vttforge/core` ships `registerSystem`, `BaseTypeDataModel` + `InferSchema<T>`, `BaseActorSheet` / `BaseItemSheet`, `createMigrationRunner`, and the `VTTF-NNNN` error catalogue (100+ tests). `@vttforge/styles` ships the full Forge design system (tokens, sheet primitives, preview page). `@vttforge/vite-plugin` owns the build contract: one Vite config, one `pnpm build`, a deployable `dist/`. The brand mark and landing page for `vttforge.dev` are in `brand/` and `apps/web/`. **Not on npm yet** — npm Trusted Publisher is the only thing standing between the current `main` and the first public release.

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
| [`@vttforge/core`](https://www.npmjs.com/package/@vttforge/core) | Runtime utilities: `BaseTypeDataModel`, `BaseActorSheet`, `BaseItemSheet`, `SystemConfig`, `registerSystem`, `fields()`, `InferSchema<T>`, `createMigrationRunner`, `getErrorManifest`, `VttfError` | 🛠️ shipped on `main` (pending first npm release) |
| `@vttforge/styles` | Design tokens (Forge theme, OKLCH, generated from W3C DTCG), sheet primitives, `.vttf-*` component classes (button, badge, input, code block, checkbox/radio/switch/range/segment, tabs, sheet primitives), opt-in themes via CSS Cascade Layers. Storybook-lite preview at `packages/styles/preview/`. | 🎨 shipped on `main` (pending first npm release) |
| [`@vttforge/vite-plugin`](https://www.npmjs.com/package/@vttforge/vite-plugin) | Vite plugin that bundles a Foundry v13+ system or module to a deployable `dist/`: browser-ESM entry (no hashing, `@vttforge/*` inlined), CSS bundle with `@import "@vttforge/styles"` resolved at build time, manifest copied under Foundry's canonical filename with `version` synced from `package.json` and `esmodules` / `styles` rewritten to the bundled output. | 🧰 shipped on `main` (pending first npm release) |
| [`@vttforge/cli`](https://www.npmjs.com/package/@vttforge/cli) | `vttforge init / dev / build` | 📋 next major track |
| [`@vttforge/testing`](https://www.npmjs.com/package/@vttforge/testing) | Quench helpers for system/module tests | 📋 v1.0 |
| [`@vttforge/types`](https://www.npmjs.com/package/@vttforge/types) | Shared TypeScript types | 📋 v1.0 |

## Design system

VTTForge ships its own design language — the **Forge theme**: warm-dark surfaces, an ember accent, a `{ d20 }` brand mark, and a 4-pt grid. The full system is documented in `packages/styles/` and previewed at `packages/styles/preview/index.html` (open the file in a browser; toggle dark / light / foundry / auto themes).

- **Brand** — `brand/` ships the mark (full color, mono, plated favicon) at `logo.svg` / `logo-mono.svg` / `favicon.svg`, plus PNG rasters at 32 / 180 / 512 px. Usage rules live in `brand/README.md`.
- **Tokens** — W3C Design Tokens source at `packages/styles/tokens.json` is compiled by Style Dictionary into `dist/tokens.css`. Three selector blocks: Forge default, `[data-theme="light"]`, and an opt-in `[data-theme="foundry"]` mapping that follows the GM's Theme V2 setting.
- **Primitives** — buttons, badges, code block + syntax tokens, form controls, tabs, code-block, and the `.sh-*` sheet primitives (portrait, quick stats, items list, dropzone, foot strip) all consume only `--vttf-*` tokens. ARIA states drive variants; `:focus-visible` is owned by the base layer.
- **Themes** — Forge is the default. Four documented recipe themes (Codex / Parchment / Grimdark / Neon) live in `examples/themes/` and re-theme everything by overriding `--vttf-*` tokens on a parent class.
- **Reference Foundry sheet** — `examples/simple-system` renders the canonical reference sheet (HP / AC / SPD / INIT quick stats, four tabs, ability scores grid with roll buttons, items list with kind pills, drop affordance) using the Forge theme. Boot it via the Docker compose below to see the SDK + design system together.

Stability, versioning and Node support: [STABILITY.md](STABILITY.md).

## Try it today

The repo ships a working Foundry v13 system you can boot in one command. Requires Docker + a [foundryvtt.com](https://foundryvtt.com) license:

```bash
git clone https://github.com/vttforge/vttforge && cd vttforge
corepack enable && pnpm install
pnpm build                                       # bundles the example system via @vttforge/vite-plugin into examples/simple-system/dist/
cp .env.example .env                             # fill in FOUNDRY_LICENSE_KEY / USERNAME / PASSWORD
docker compose -f docker-compose.dev.yml up      # → http://localhost:30000
```

Inside Foundry: create a world on **VTTForge Example System**, add a Character actor. The sheet renders the canonical reference layout — header with HP / AC / SPD / INIT quick stats, four tabs (Abilities · Inventory · Spells · Biography), ability scores grid with roll buttons, items list with kind pills (`equipped` / `valued` / `stowed`), drop affordance, and the demo migration runs at world load.

## Quick start (after `@vttforge/cli` ships)

> Coming with `@vttforge/cli`. The shape will look like this:

```bash
# Scaffold a new FoundryVTT system in TypeScript
npx @vttforge/cli init my-system --type system --lang ts

# Start the dev server with HMR for .hbs templates
cd my-system
vttforge dev --foundry-data ~/Library/Application\ Support/FoundryVTT/Data

# Production build
vttforge build
```

Until then, the contract is already runnable today via the Vite plugin directly — see `examples/simple-system/vite.config.mjs` for the minimal setup.

## Design principles

1. **Zero lock-in.** VTTForge outputs plain `.mjs` files that Foundry loads natively. You can drop VTTForge from your project at any time.
2. **Type-safe by default.** Full TypeScript declarations. Eventually, schema-to-type inference (Zod-style) so you stop double-typing your data models.
3. **Battle-tested.** Every API is validated against a real production FoundryVTT system before being shipped.
4. **Modern tooling.** pnpm 10+ with Corepack and catalogs, Turborepo, `tsdown` (Rolldown-based), Vite (consumer dev server), Biome (+ optional Oxlint), Changesets with npm OIDC trusted publishing, `publint` + `attw` + `knip` + `syncpack`, `lefthook`. The same stack the rest of the JS ecosystem uses in 2026.
5. **Community first.** MIT licensed. No paid tiers. Sponsor optional.

## Roadmap

- ✅ **Foundation** — Monorepo (pnpm + Turborepo), CI on self-hosted runners, npm OIDC publish workflow, six `@vttforge/*` package stubs
- ✅ **Core SDK** — `registerSystem`, `BaseTypeDataModel` + `InferSchema<T>` (partial), `BaseActorSheet` / `BaseItemSheet`, `createMigrationRunner`, `VTTF-NNNN` error registry
- ✅ **Design system** — Forge tokens (W3C DTCG), `.vttf-*` primitives, brand mark, Storybook-lite preview, landing page
- ✅ **Build pipeline** — `@vttforge/vite-plugin` (browser-ESM bundle, CSS pipeline, manifest sync, watch graph)
- 📦 **Next: first public release** — wire up npm Trusted Publisher, flip the repo public, tag-and-publish all six packages via OIDC
- 🛠️ **After that** — `@vttforge/cli` scaffolding, `vttforge.dev` docs site (VitePress + Pagefind), Foundry-aware HMR for `.hbs`
- 🚀 **v1.0** — Full schema-to-type inference, decorators (`@SystemSetting`, `@DocumentSheet`), Quench-based `@vttforge/testing`, stable API

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
