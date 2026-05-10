# VTTForge — Product Requirements Document

**Version:** 1.2.0
**Last updated:** 2026-05-10
**Author:** Fabricio Cavalcante de Souza ([@fcsouza](https://github.com/fcsouza))
**Status:** Active — names reserved, repo skeleton in progress

---

## 1. Overview

**VTTForge** is a developer SDK and CLI for building [FoundryVTT](https://foundryvtt.com) v13+ systems and modules. It eliminates boilerplate, introduces declarative APIs, and ships tooling that scaffolds and builds projects from scratch.

The first consumer of this SDK is **Ordem Paranormal RPG** ([`ordemparanormal_fvtt`](https://github.com/fcsouza/ordemparanormal_fvtt)) — a production FoundryVTT system. Every API decision is validated against that codebase before being generalized.

### What changed in v1.2

This revision finalizes the tooling and CSS strategy before v0.1 implementation begins:

- **Bundler:** `tsdown` (Rolldown-based) replaces Vite library mode for publishing the SDK packages
- **Package manager:** pnpm + Corepack replaces Bun workspaces (better publish/provenance/peer-dep story for a public SDK)
- **Quality toolkit:** added `publint`, `@arethetypeswrong/cli`, `knip`, `syncpack`, `lefthook`, `tsx`
- **CI/release:** detailed pipeline with npm provenance via OIDC, branch protection, and changesets/action
- **CSS strategy:** new `@vttforge/styles` package built on CSS Cascade Layers; `@vttforge/vite-plugin` ships a vanilla CSS + PostCSS pipeline (Sass opt-in, Tailwind via documented recipe only)
- **Documentation cleanup:** the obsolete `FVTT-SDK-PRD.md` draft is removed (this `PRD.md` is the single source of truth)

### What changed in v1.1

The previous revision superseded the original `FVTT-SDK-PRD.md` by:

- Renaming the project from `@fvtt-sdk/*` to `@vttforge/*` (trademark safety + brand identity)
- Recording infrastructure milestones (npm org, GitHub org, placeholder publishes)
- Sharpening the v0.1 roadmap based on the boilerplate audit
- Adding a public-facing pitch and trademark disclaimer

---

## 2. Project identity

| Asset | Location | Status |
|---|---|---|
| Name | **VTTForge** | ✅ Final |
| GitHub org | [`github.com/vttforge`](https://github.com/vttforge) | ✅ Created |
| npm scope | [`npmjs.com/~vttforge`](https://www.npmjs.com/~vttforge) | ✅ Created |
| Domain | `vttforge.dev` (planned) | ⏳ Pending |
| Discord | TBD | ⏳ Pending |
| Tagline | "A modern SDK and CLI for building FoundryVTT systems and modules." | ✅ |

### Trademark posture

VTTForge is a **community project** and is not affiliated with Foundry Gaming LLC. The name follows [Foundry's own brand guidelines](https://foundryvtt.com/article/branding/), which recommend "Foundry VTT" or "FVTT" as acceptable abbreviations and prohibit using "Foundry Virtual Tabletop" in project titles. The name `VTTForge` uses only the generic industry term "VTT" (virtual tabletop), avoiding the Foundry trademark entirely.

Standard disclaimer for all repos and packages:

> VTTForge is an independent, community-developed project. It is not affiliated with, endorsed by, or sponsored by Foundry Gaming LLC. "Foundry Virtual Tabletop", "Foundry VTT", and "FVTT" are trademarks of Foundry Gaming LLC.

---

## 3. Problem statement

Building FoundryVTT systems and modules requires:

1. **Imperative, scattered initialization** — settings, sheets, data models, and document classes are registered via `Hooks.once("init")` with hardcoded string IDs
2. **Repeated structural boilerplate** — every sheet copy-pastes 36-line `DragDrop` wiring, 50-line `_getTabs()` switches, and identical `_onEditImage` handlers
3. **No type inference from schema** — developers define a `TypeDataModel` schema and then manually write a matching TypeScript interface (double work)
4. **No project scaffold** — every new system or module starts from scratch, creating inconsistent structures across the community
5. **No HMR for Handlebars templates** — editing `.hbs` files requires reloading the entire browser + canvas

### Confirmed pain points in `ordemparanormal` (pre-SDK baseline)

| Boilerplate pattern | Occurrences | Lines wasted |
|---|---|---|
| `#createDragDropHandlers()` verbatim copy | 3 sheets | ~108 |
| `_getTabs()` switch tables | 3 sheets | ~180 |
| `game.settings.get("ordemparanormal", ...)` hardcoded ID | ~10 calls | risk of typo |
| `const fields = foundry.data.fields` per-method | 14 occurrences | — |
| Stub `migrateData(data) { return super.migrateData(data) }` | 8 data models | ~24 |
| `#onEditImage` FilePicker copy | 2 sheets | ~30 |
| Settings getters duplicated on Actor + Sheet | 4 × 2 | ~24 |
| `_onDrop` switch handler copy | 2 sheets | ~60 |
| **Total estimated boilerplate** | | **~430 lines** |

---

## 4. Goals

### Primary goals (v0.1 → v1.0)

1. **`@vttforge/core`** — Runtime utilities that eliminate the boilerplate patterns above with zero lock-in (output is plain `.mjs` files Foundry loads directly)
2. **`@vttforge/cli`** — `vttforge init`, `vttforge dev`, `vttforge build` commands
3. **`@vttforge/vite-plugin`** — HMR for `.hbs` templates, manifest auto-sync, Foundry `Data/` symlink
4. **Migrate `ordemparanormal` to VTTForge** — validates every API with a real production system

### Secondary goals (v1.x)

5. **Schema-to-TypeScript inference** — derive TS interfaces from `defineSchema()` automatically (Zod-style)
6. **Decorator API** — `@SystemSetting`, `@DocumentSheet` class decorators for registration
7. **`@vttforge/testing`** — Quench test helpers for system/module unit testing
8. **Stable public API** — semver guarantees from v1.0 onward

### Non-goals

- Wrapping the full FoundryVTT canvas API (PIXI.js layers, tokens, lighting)
- Supporting FoundryVTT v12 or below
- Building a UI component library (Handlebars/Svelte components)
- Replacing [`libWrapper`](https://github.com/ruipin/fvtt-lib-wrapper) or [`socketlib`](https://github.com/manuelVo/foundryvtt-socketlib)

---

## 5. Tech stack

### Source + types

| Technology | Role | Link |
|---|---|---|
| **TypeScript 5.x** | Source language; strict mode, ESM-only | https://www.typescriptlang.org |
| **ESM output (`.mjs` + `.d.mts`)** | Foundry loads ES modules natively | https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules |
| **`foundry-vtt-types`** | Type definitions for the Foundry API (pinned) | https://github.com/League-of-Foundry-Developers/foundry-vtt-types |

### Library bundler (`@vttforge/core`, `@vttforge/cli`, `@vttforge/vite-plugin`)

| Technology | Role | Link |
|---|---|---|
| **`tsdown`** | Rolldown-based ESM-first bundler; emits `.mjs` + `.d.mts` cleanly | https://github.com/rolldown/tsdown |

> Vite library mode was the original choice but is awkward for multi-entry SDKs that need clean `.d.mts`. `tsup` is in maintenance. `tsdown` is the recommended 2026 library bundler.

### Consumer dev server (`@vttforge/vite-plugin`)

| Technology | Role | Link |
|---|---|---|
| **Vite 6** | Dev server consumed by `vttforge dev` (HMR, asset graph) | https://vitejs.dev |
| **`vite-plugin-handlebars`** | HMR for `.hbs` templates (validate activity; internalize if stale) | https://github.com/nicktindall/vite-plugin-handlebars |

### CLI (`@vttforge/cli`)

| Technology | Role | Link |
|---|---|---|
| **Node.js 20+ (Bun optional for local dev)** | Runtime | https://nodejs.org |
| **Citty** | CLI framework (lightweight, typed, unjs-aligned) | https://github.com/unjs/citty |
| **Giget** | Template scaffolding (`degit`-like) | https://github.com/unjs/giget |
| **Clack** | Interactive prompts | https://github.com/bombshell-dev/clack |

### Monorepo

| Technology | Role | Link |
|---|---|---|
| **Turborepo** | Task pipeline + remote caching | https://turbo.build |
| **pnpm + Corepack** | Package manager + workspaces | https://pnpm.io |
| **Changesets** | Versioning + changelog | https://github.com/changesets/changesets |

> pnpm replaces Bun workspaces. For a public SDK publishing 5+ packages, pnpm has the more mature publish/peer-dep/provenance story. Bun stays as an optional local runtime, never the install path.

### Quality

| Technology | Role | Link |
|---|---|---|
| **Biome** | Linting + formatting (single binary, no plugin sprawl) | https://biomejs.dev |
| **Vitest** | Unit testing (with `happy-dom` for sheet-render tests) | https://vitest.dev |
| **Quench (via FVTT)** | In-world integration testing | https://github.com/Ethaks/FVTT-Quench |
| **GitHub Actions** | CI/CD | https://docs.github.com/en/actions |

### 5.1 Publishing quality toolkit

These are required to ship a high-quality public TypeScript SDK in 2026. All are wired into CI as gates (or warnings, see §6).

| Tool | Purpose | Link |
|---|---|---|
| **`publint`** | Validates `package.json` `exports`/`types`/`main`/`module` correctness | https://publint.dev |
| **`@arethetypeswrong/cli` (attw)** | Validates `.d.mts` resolves under Node ESM, bundlers, and `nodenext` | https://github.com/arethetypeswrong/arethetypeswrong.github.io |
| **`knip`** | Detects unused exports/files across the monorepo | https://knip.dev |
| **`syncpack`** | Keeps shared dependency versions in sync across packages | https://jamiemason.github.io/syncpack |
| **`lefthook`** | Git hooks (pre-commit Biome on staged, pre-push typecheck) | https://github.com/evilmartians/lefthook |
| **`tsx`** | Running TS scripts in `scripts/` | https://github.com/privatenumber/tsx |
| **npm provenance** | SLSA attestation via `--provenance` + GitHub OIDC | https://docs.npmjs.com/generating-provenance-statements |
| **`changeset-bot` (GH App)** | Comments on PRs missing changesets | https://github.com/apps/changeset-bot |

### 5.2 CSS pipeline

Default: vanilla CSS + PostCSS (`autoprefixer`, `postcss-nesting`, `postcss-custom-media`). Sass is supported when the consumer installs it (Vite native), but is not a peer dependency. Tailwind is **not** bundled — see `docs/recipes/tailwind.md` (Tailwind v4 + cascade layers recipe). `@vttforge/styles` is the new package providing the base layer (see §6 and §7.5).

---

## 6. Architecture

### Repository structure

```
vttforge/                            # Turborepo monorepo (pnpm workspaces)
├── packages/
│   ├── core/                        # @vttforge/core (runtime JS only)
│   │   ├── src/
│   │   │   ├── index.mts
│   │   │   ├── system/
│   │   │   │   ├── system-config.mts    # SystemConfig singleton
│   │   │   │   └── register-system.mts  # registerSystem() one-call init
│   │   │   ├── data/
│   │   │   │   ├── base-type-model.mts  # BaseTypeDataModel
│   │   │   │   └── fields.mts           # f = foundry.data.fields re-export
│   │   │   ├── sheets/
│   │   │   │   ├── base-actor-sheet.mts # DragDrop, tabs, onEditImage, _onDrop
│   │   │   │   └── base-item-sheet.mts
│   │   │   └── migrations/
│   │   │       └── migration-runner.mts
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── styles/                      # @vttforge/styles (NEW — base CSS layer)
│   │   ├── src/
│   │   │   ├── tokens.css           # CSS custom properties (--vttf-*)
│   │   │   ├── reset.css            # minimal Foundry-aware reset
│   │   │   ├── base.css             # sheet layout primitives
│   │   │   ├── components.css      # tabs, drag-drop, inputs, buttons, dialogs
│   │   │   ├── themes/
│   │   │   │   ├── light.css
│   │   │   │   ├── dark.css
│   │   │   │   ├── high-contrast.css
│   │   │   │   └── auto.css         # respects prefers-color-scheme
│   │   │   └── index.css            # tokens + reset + base + components (no theme)
│   │   └── package.json
│   ├── cli/                         # @vttforge/cli
│   │   ├── src/
│   │   │   ├── index.mts
│   │   │   └── commands/
│   │   │       ├── init.mts        # vttforge init
│   │   │       ├── dev.mts         # vttforge dev (Vite HMR)
│   │   │       └── build.mts       # vttforge build
│   │   └── templates/
│   │       ├── system/             # Scaffold templates for systems
│   │       └── module/             # Scaffold templates for modules
│   ├── vite-plugin/                # @vttforge/vite-plugin
│   │   └── src/
│   │       ├── index.mts
│   │       ├── hbs-hmr.mts         # HMR for .hbs files
│   │       ├── css-pipeline.mts    # PostCSS preset; Sass opt-in detection
│   │       └── manifest-sync.mts   # Auto-sync system.json / module.json
│   ├── testing/                    # @vttforge/testing (v1.x)
│   └── types/                      # @vttforge/types (v1.x)
├── examples/
│   ├── simple-system/              # Minimal system using VTTForge
│   └── simple-module/              # Minimal module using VTTForge
├── docs/
│   └── recipes/
│       └── tailwind.md             # Tailwind v4 + cascade layers recipe (opt-in)
├── .github/
│   └── workflows/
│       ├── ci.yml                  # lint, typecheck, test, build, package-quality, knip
│       ├── release.yml             # changesets/action with --provenance
│       └── canary.yml              # opt-in preview publishes (v0.2+)
├── .changeset/
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
├── biome.json
├── lefthook.yml
├── PRD.md
├── README.md
├── CHANGELOG.md
└── CONTRIBUTING.md
```

### CI / release pipeline

**`ci.yml`** (PR + push to `main`) — required jobs:

- `lint` → `biome ci . && pnpm syncpack lint`
- `typecheck` → `turbo run typecheck`
- `test` → `turbo run test` (Node 20 + Node 22 matrix)
- `build` → `turbo run build`
- `package-quality` → `turbo run publint && turbo run attw` (depends on `build`)
- `knip` → non-blocking until v0.1.0, blocking after

Setup: `actions/setup-node@v4` + Corepack + `pnpm/action-setup@v4` with cached `~/.pnpm-store` and Turbo remote cache.

**`release.yml`** (push to `main`):

- Single job using `changesets/action@v1` (opens "Version Packages" PR or publishes when merged)
- Permissions: `contents: write`, `pull-requests: write`, `id-token: write` (last enables provenance)
- Publish: `pnpm publish -r --provenance --access public --no-git-checks`
- Auth: `NPM_TOKEN` granular automation token, or Trusted Publishing once available for scoped orgs

**Branch protection on `main`:** PR review (1), required checks (`lint`, `typecheck`, `test`, `build`, `package-quality`), linear history, no force pushes.

---

## 7. API design

### `SystemConfig`

Eliminates the hardcoded system/module ID string scattered throughout the codebase.

```ts
import { SystemConfig } from "@vttforge/core";

const sys = new SystemConfig("my-system");

// Settings
sys.register("difficulty", { type: String, default: "normal", config: true, scope: "world" });
sys.get("difficulty");                  // game.settings.get("my-system", "difficulty")
sys.set("difficulty", "hard");          // game.settings.set("my-system", "difficulty", "hard")

// Flags
sys.getFlag(actor, "customData");       // actor.getFlag("my-system", "customData")
sys.setFlag(actor, "customData", data);
```

### `BaseTypeDataModel`

Eliminates stub `migrateData` overrides and the per-method `const fields = foundry.data.fields` alias.

```ts
import { BaseTypeDataModel, f } from "@vttforge/core";

class AgentData extends BaseTypeDataModel {
  static defineSchema() {
    return {
      level:  new f.NumberField({ required: true, integer: true, initial: 1, min: 1 }),
      health: new f.SchemaField({
        value: new f.NumberField({ required: true, integer: true, min: 0, initial: 10 }),
        max:   new f.NumberField({ required: true, integer: true, min: 0, initial: 10 })
      }),
      biography: new f.HTMLField({ initial: "" })
    };
  }

  prepareDerivedData() {
    this.health.max = 10 + this.level * 2;
  }
  // migrateData() — no stub needed; BaseTypeDataModel provides the default
}
```

### `BaseActorSheet` / `BaseItemSheet`

Eliminates copy-pasted DragDrop wiring, `_getTabs()` switch tables, `#onEditImage`, and `_onDrop` dispatch.

```ts
import { BaseActorSheet } from "@vttforge/core";

class CharacterSheet extends BaseActorSheet {
  static DEFAULT_OPTIONS = {
    classes: ["my-system"],
    window:  { title: "Character Sheet" }
  };

  static PARTS = {
    header:     { template: "systems/my-system/templates/actor/header.hbs" },
    attributes: { template: "systems/my-system/templates/actor/attributes.hbs" },
    inventory:  { template: "systems/my-system/templates/actor/inventory.hbs" }
  };

  // Declare tabs — _getTabs() is auto-generated from this
  static TABS = {
    attributes: { group: "primary", icon: "fa-user",     label: "MY_SYSTEM.Attributes" },
    inventory:  { group: "primary", icon: "fa-backpack", label: "MY_SYSTEM.Inventory"  }
  };

  // DragDrop, _onEditImage, and _onDrop switch handler — provided by BaseActorSheet
  // Override _onDropItem / _onDropActor / _onDropActiveEffect for custom logic

  async _prepareContext(options) {
    return { actor: this.document, system: this.document.system };
  }
}
```

### `registerSystem`

Replaces 60+ lines of `Hooks.once("init")` boilerplate.

```ts
import { registerSystem } from "@vttforge/core";

Hooks.once("init", () => {
  registerSystem({
    id: "my-system",
    actors: {
      character: { dataModel: CharacterData, sheet: CharacterSheet, makeDefault: true },
      npc:       { dataModel: NpcData,       sheet: NpcSheet,       makeDefault: true }
    },
    items: {
      weapon: { dataModel: WeaponData, sheet: ItemSheet },
      spell:  { dataModel: SpellData,  sheet: ItemSheet }
    },
    documentClasses: {
      Actor: MyActor,
      Item:  MyItem
    },
    combatInitiative: "1d20 + @abilities.dex.mod"
  });
});
```

### `createMigrationRunner`

Replaces hand-rolled migration loops.

```ts
import { createMigrationRunner } from "@vttforge/core";

const migrate = createMigrationRunner([
  { version: 1, fn: async () => { /* v1 migrations */ } },
  { version: 2, fn: async () => { /* v2 migrations */ } }
]);

Hooks.once("ready", async () => {
  if (!game.user.isGM) return;
  await migrate("my-system", "schemaVersion");
});
```

### CLI

```bash
# Scaffold a new system
vttforge init my-system --type system --lang ts

# Scaffold a new module
vttforge init my-module --type module --lang ts

# Start dev server with HMR + auto-symlink to Foundry Data/
vttforge dev --foundry-data /path/to/foundry/Data

# Production build (bundle + sync manifest + zip for release)
vttforge build
```

### `@vttforge/styles` — base CSS layer

Ships a CSS foundation that eliminates the most copy-pasted styles in the FoundryVTT community (drag-drop affordances, tab styling, sheet layout primitives) without fighting consumer styles.

**Scoping with CSS Cascade Layers:**

```css
@layer foundry, vttforge.tokens, vttforge.base, vttforge.components, system;
```

Consumer system styles fall into the implicit `system` layer (highest), so consumers always win without `!important`. Foundry's unlayered styles still win against layered ones where appropriate.

**Recommended consumption — explicit:**

```css
/* my-system/styles/main.css */
@import "@vttforge/styles";   /* tokens + reset + base + components */
@import "@vttforge/styles/themes/auto.css";  /* opt-in theme */

/* your system styles here automatically land in the `system` layer */
.my-system .character-name { ... }
```

**Auto-inject (opt-in via vite-plugin):**

```ts
// vite.config.ts
import { vttforge } from "@vttforge/vite-plugin";

export default {
  plugins: [vttforge({ injectBaseStyles: true })]   // off by default
};
```

**What ships:**

- `tokens.css` — design tokens via `--vttf-*` custom properties (color, spacing 4/8/12/16/24/32/48, type scale, radii, shadows, motion). Tokens fall back to Foundry's own variables where they exist (`--vttf-color-bg: var(--color-bg, #1d1d1d);`).
- `reset.css` — minimal reset that respects Foundry's existing baseline.
- `base.css` — `.vttf-window`, `.vttf-parts`, `.vttf-tab-bar`, `.vttf-tab-panel`.
- `components.css` — drag-drop (`.vttf-drop-target`, `.vttf-dragging`, `.vttf-drop-valid/invalid`), tabs paired with `static TABS` from `BaseActorSheet`, opt-in `.vttf-input` form baseline.
- `themes/{light,dark,high-contrast,auto}.css` — opt-in theme overrides via `.vttf-theme-*` class scopes.

The plugin writes the resolved CSS path into the system manifest's `styles` field during `vttforge build`.

---

## 8. Migration plan: `ordemparanormal` → VTTForge

This is the first project to adopt VTTForge. The migration is phased to de-risk each change.

### Phase 1 — Core runtime (no CLI yet)

1. Install `@vttforge/core` once published (or temporarily copy `src/` into `module/sdk/` for early dev)
2. Replace all 8 data models with `BaseTypeDataModel` — remove stub `migrateData`, use `f.*` alias
3. Refactor `actor-sheet.mjs`, `item-sheet.mjs`, `threat-sheet.mjs` to extend `BaseActorSheet`/`BaseItemSheet` — remove DragDrop, `_getTabs`, `_onEditImage`, `_onDrop` copies
4. Introduce `SystemConfig` — replace all `game.settings.get("ordemparanormal", ...)` calls

**Verification:** run Quench tests, visually test all sheets in Foundry.

### Phase 2 — `registerSystem`

5. Replace `Hooks.once("init")` registration block in `ordemparanormal.mjs` with `registerSystem()`

**Verification:** full system boot, character creation, item rolls.

### Phase 3 — Vite + HMR (optional but valuable)

6. Add `@vttforge/vite-plugin` — configure HMR for `.hbs` templates
7. Run `vttforge dev` for local development

---

## 9. Roadmap & status

### ✅ v0.0.0 — Infrastructure (DONE)

- [x] Project name decided: **VTTForge**
- [x] GitHub org created: [`github.com/vttforge`](https://github.com/vttforge)
- [x] npm scope created: [`npmjs.com/~vttforge`](https://www.npmjs.com/~vttforge)
- [x] Placeholder packages reserved on npm:
  - [x] [`@vttforge/core@0.0.0`](https://www.npmjs.com/package/@vttforge/core)
  - [x] [`@vttforge/cli@0.0.0`](https://www.npmjs.com/package/@vttforge/cli)
  - [x] [`@vttforge/vite-plugin@0.0.0`](https://www.npmjs.com/package/@vttforge/vite-plugin)
  - [x] [`@vttforge/testing@0.0.0`](https://www.npmjs.com/package/@vttforge/testing)
  - [x] [`@vttforge/types@0.0.0`](https://www.npmjs.com/package/@vttforge/types)
- [x] Trademark disclaimer drafted (in placeholder READMEs)

### 🏗️ v0.1.0 — Core runtime + repo foundation (IN PROGRESS)

- [ ] Turborepo monorepo skeleton (`packages/*`, `turbo.json`, root `package.json` with **pnpm workspaces** + Corepack)
- [ ] `tsdown` configured per package for `.mjs` + `.d.mts` output
- [ ] Biome config (lint + format)
- [ ] Changesets setup
- [ ] `lefthook.yml` with pre-commit Biome and pre-push typecheck
- [ ] `syncpack` config to keep dep versions aligned
- [ ] TypeScript base config (strict, ESM-only, `.mts` output)
- [ ] CI: `.github/workflows/ci.yml` with `lint`, `typecheck`, `test`, `build`, `package-quality` (publint + attw), `knip`
- [ ] CI: `.github/workflows/release.yml` with changesets/action and `--provenance`
- [ ] `@vttforge/core`:
  - [ ] `f` fields alias re-export
  - [ ] `BaseTypeDataModel`
  - [ ] `SystemConfig`
  - [ ] `BaseActorSheet` (DragDrop, TABS, onEditImage, _onDrop)
  - [ ] `BaseItemSheet`
  - [ ] `createMigrationRunner`
  - [ ] `registerSystem`
- [ ] `@vttforge/styles`:
  - [ ] `tokens.css`, `reset.css`, `base.css`, `components.css`, `index.css`
  - [ ] Cascade layers wiring (`@layer foundry, vttforge.tokens, vttforge.base, vttforge.components, system;`)
  - [ ] Opt-in themes (`light`, `dark`, `high-contrast`, `auto`)
- [ ] `examples/simple-system` working demo (consumes `@vttforge/core` + `@vttforge/styles`)
- [ ] Migrate `ordemparanormal` to use all of the above

### 📦 v0.2.0 — Build tooling

- [ ] `@vttforge/vite-plugin`:
  - [ ] HMR for `.hbs` templates
  - [ ] CSS pipeline (PostCSS preset; Sass detection; `injectBaseStyles` option)
  - [ ] Manifest sync (`system.json` / `module.json`) including `styles` field rewrite during dev
  - [ ] Foundry `Data/` symlink helper
- [ ] `docs/recipes/tailwind.md` — Tailwind v4 + cascade layers recipe
- [ ] `.github/workflows/canary.yml` — `release: canary` PR label triggers preview publish

### 🚀 v1.0.0 — Stable API

- [ ] Schema-to-TypeScript inference (no double-typing)
- [ ] `@SystemSetting` decorator
- [ ] `@DocumentSheet` decorator
- [ ] `@vttforge/testing` (Quench helpers)
- [ ] Full TypeScript declarations + `.d.mts` output
- [ ] Stable public API + semver guarantee
- [ ] Submission to FoundryVTT package list (if applicable for tools)

---

## 10. Success criteria

1. The `ordemparanormal` migration removes **400+ lines of boilerplate** with no functionality regression (Quench tests pass, all sheets work in Foundry)
2. A new system can be scaffolded and loaded in Foundry in under 5 minutes using `vttforge init`
3. Editing a `.hbs` template hot-reloads in the browser without reloading the canvas
4. Zero FoundryVTT global references during module `import` — all deferred to `Hooks.once("init")` or function bodies
5. The SDK ships with full TypeScript declarations
6. At least one external community member adopts VTTForge for their own system or module within 90 days of v0.1 release

---

## 11. Open questions

### Resolved in v1.2

- **Package distribution** — scoped `@vttforge/*` packages on npm. ✅
- **ESM-only vs dual CJS/ESM** — ESM-only. ✅
- **Library bundler** — `tsdown`. ✅
- **Package manager** — pnpm + Corepack. ✅
- **CSS — base styles location** — separate `@vttforge/styles` package. ✅
- **CSS — scoping strategy** — Cascade Layers (`@layer foundry, vttforge.tokens, vttforge.base, vttforge.components, system;`). ✅
- **CSS — Tailwind** — not bundled; documented recipe (`docs/recipes/tailwind.md`). ✅
- **CSS — pipeline default** — vanilla CSS + PostCSS, Sass opt-in. ✅

### Still open

1. **`registerSystem` placement** — should it wrap `Hooks.once("init")` itself (caller just calls `registerSystem()` at module top level) or require the caller to be inside a hook? Wrapping is cleaner DX but hides the lifecycle. **Lean: explicit hook for now, magic later.**
2. **Vite as a hard CLI dependency** — forces Vite on everyone using `vttforge dev/build`. Consider making it optional (bring-your-own bundler) with the plugin as an add-on. **Lean: Vite-first for v0.x, abstract in v1.0.**
3. **Decorator strategy** — TC39 stage 3 decorators vs experimental. Foundry community ships ESM, but decorators add transpilation requirements. **Lean: skip decorators for v0.1, revisit after stage 3 stabilizes in TS 5.5+.**
4. **Patreon / sponsorship** — should VTTForge accept GitHub Sponsors / Patreon to fund development? Affects how the project is positioned (pure community vs sustainable side-project). **Lean: enable sponsors at v0.1 release, no required tiers.**
5. **Trusted Publishing on npm** — switch from `NPM_TOKEN` to OIDC-based Trusted Publishing once the feature is stable for scoped orgs. Tracking; non-blocking for v0.1.

---

## 12. Reference links

### FoundryVTT official

- API docs v13: https://foundryvtt.com/api/v13/
- Brand guidelines: https://foundryvtt.com/article/branding/
- Package submission: https://foundryvtt.com/packages/submit
- Official CLI: https://github.com/foundryvtt/foundryvtt-cli
- FoundryVTT Discord (dev channel): https://discord.gg/foundryvtt

### Community resources

- League of Foundry Developers: https://github.com/League-of-Foundry-Developers
- `foundry-vtt-types`: https://github.com/League-of-Foundry-Developers/foundry-vtt-types
- Module template (TS + Vite): https://github.com/League-of-Foundry-Developers/FoundryVTT-Module-Template
- Quench (in-game testing): https://github.com/Ethaks/FVTT-Quench
- libWrapper: https://github.com/ruipin/fvtt-lib-wrapper
- socketlib: https://github.com/manuelVo/foundryvtt-socketlib
- FoundryVTT Brasil (Discord): https://discord.gg/foundryvtt-brasil

### Comparable abstractions (inspiration)

- Zod (schema-to-type inference): https://zod.dev
- Citty (CLI framework): https://github.com/unjs/citty
- Unplugin (Vite/Rollup plugin boilerplate): https://github.com/unjs/unplugin
- unjs ecosystem (modern JS tooling patterns): https://unjs.io

### VTTForge

- GitHub org: https://github.com/vttforge
- npm scope: https://www.npmjs.com/~vttforge
- Main monorepo: https://github.com/vttforge/vttforge *(to be created)*
- Domain: https://vttforge.dev *(planned)*

### First consumer

- `ordemparanormal` system: https://github.com/fcsouza/ordemparanormal_fvtt
- Ordem Paranormal RPG: https://www.jamboeditora.com.br/produto/ordem-paranormal-rpg/

---

## Disclaimer

VTTForge is an independent, community-developed project. It is not affiliated with, endorsed by, or sponsored by Foundry Gaming LLC. "Foundry Virtual Tabletop", "Foundry VTT", and "FVTT" are trademarks of Foundry Gaming LLC.
