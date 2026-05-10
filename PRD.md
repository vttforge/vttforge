# VTTForge — Product Requirements Document

**Version:** 1.3.0
**Last updated:** 2026-05-10
**Author:** Fabricio Cavalcante de Souza ([@fcsouza](https://github.com/fcsouza))
**Status:** Active — names reserved, repo skeleton in progress

---

## 1. Overview

**VTTForge** is a developer SDK and CLI for building [FoundryVTT](https://foundryvtt.com) v13+ systems and modules. It eliminates boilerplate, introduces declarative APIs, and ships tooling that scaffolds and builds projects from scratch.

The first consumer of this SDK is **Ordem Paranormal RPG** ([`ordemparanormal_fvtt`](https://github.com/fcsouza/ordemparanormal_fvtt)) — a production FoundryVTT system. Every API decision is validated against that codebase before being generalized.

### What changed in v1.3

This revision applies corrections from a full web-source verification pass (May 2026). Every recommendation in §5 and §6 is now backed by current GitHub release activity, official docs, or 2026 ecosystem reports — see linked sources inline.

- **Cascade layer naming corrected:** Foundry v13 already owns the cascade-layer namespace (`reset, variables, elements, blocks, applications, compatibility, layouts, system, modules, exceptions`) and auto-wraps consumer manifest CSS in the `system` layer. VTTForge's layers must use a vendored prefix only: `@layer vttforge.reset, vttforge.tokens, vttforge.base, vttforge.components`. Earlier draft used `foundry` and `system` names — those would be ignored or misordered by Foundry's runtime.
- **Handlebars HMR plugin reference corrected:** the previously cited `nicktindall/vite-plugin-handlebars` does not exist. Replaced with `alexlafroscia/vite-plugin-handlebars` v2.0.3 (Apr 2026, claims Vite 5–8 support) plus a small custom plugin in `@vttforge/vite-plugin` for sheet-template re-render (alexlafroscia's HMR-for-partials story has open issues since 2024).
- **`foundry-vtt-types` was renamed to `fvtt-types`** — installed via `npm add -D fvtt-types@github:League-of-Foundry-Developers/foundry-vtt-types#<sha>`. Pin a git SHA, not an npm tag (last npm release v13.341.1 is 10 months old).
- **CI pipeline modernized:**
  - `pnpm/action-setup@v4` → `@v6` (v4 is two majors behind; v6 reads version from `packageManager` field).
  - npm Trusted Publishing (OIDC) became GA on 2025-07-31 — drop `NPM_TOKEN` and `--provenance` flag (auto-generated under OIDC). Configure trusted publisher per package on npmjs.com.
  - Split into two workflows (`changesets.yml` + `publish.yml`) per `changesets/action#515` — combining PR creation and OIDC publish in one workflow has known frictions.
  - npm CLI ≥ 11.5.1 and Node ≥ 22.14.0 required for trusted publishing.
- **Tailwind recipe downgraded:** v4 has open Electron compatibility issues (`electron-vite#741`, hover bugs `tailwindcss#16531`/`#17234`). Primary recipe is now Tailwind v3; v4 marked experimental until those land.
- **Foundry Theme V2 integration:** `@vttforge/styles` tokens consume Foundry's built-in theme variables (`--color-text-primary`, `--background`, etc. from `CONST.CSS_THEMES`) instead of redefining them.
- **pnpm catalogs adopted from v0.1:** the 2026-native cross-workspace pinning mechanism. `syncpack` v15.0.0 (May 2026) auto-migrates to and validates them.
- **Mantine-style `styles.layer.css` variant** added to `@vttforge/styles` for consumers wanting explicit layer wrapping.
- **`tsdown` DTS+peer-deps caveat documented:** `rolldown-plugin-dts#199` is unresolved — mitigated via explicit `external` config and `dts.resolve` options.
- **Optional Oxlint pre-check:** v1.0 stable since Aug 2025, ~2x faster than Biome on its ~300 rules. Optional CI fast-fail layer; not a Biome replacement.

### What changed in v1.2

This revision finalized the tooling and CSS strategy before v0.1 implementation:

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
| **`fvtt-types`** (formerly `foundry-vtt-types`) | Type definitions for the Foundry API. Install via `fvtt-types@github:League-of-Foundry-Developers/foundry-vtt-types#<sha>` — pin a git SHA from `main`, not an npm tag (last npm release v13.341.1 is 10 months old as of May 2026; project is still beta for v13). | https://github.com/League-of-Foundry-Developers/foundry-vtt-types |

### Library bundler (`@vttforge/core`, `@vttforge/cli`, `@vttforge/vite-plugin`)

| Technology | Role | Link |
|---|---|---|
| **`tsdown`** | Rolldown-based ESM-first bundler; emits `.mjs` + `.d.mts` cleanly. Pin `^0.22` (last release v0.22.0, 2026-05-07; weekly cadence). | https://github.com/rolldown/tsdown |

> `tsup` was officially deprecated in late 2025 — its README points users to `tsdown` (last release v8.5.1, 2025-11-12). Vite's own docs now direct library authors to `tsdown` as the foundation Rolldown-Vite library mode is being built on. Real adopters: unjs/unplugin, TresJS, multiple unjs packages. Caveat: `rolldown-plugin-dts#199` (open Mar 2026) — keeping a pkg external in JS while inlining its types in DTS is tricky; mitigate with explicit `external` list for the Foundry global surface and `dts.resolve` configuration.

### Consumer dev server (`@vttforge/vite-plugin`)

| Technology | Role | Link |
|---|---|---|
| **Vite 6+** | Dev server consumed by `vttforge dev` (HMR, asset graph). Vite 8 ships with Rolldown as the unified Rust bundler — track migration. | https://vitejs.dev |
| **`alexlafroscia/vite-plugin-handlebars`** | Handlebars template compilation in Vite (claims Vite 5–8 support; v2.0.3, Apr 2026). HMR for *partials* has open issues since 2024 (#249, #251). | https://github.com/alexlafroscia/vite-plugin-handlebars |
| **Custom sheet HMR plugin** (in `@vttforge/vite-plugin`) | Watches `templates/**/*.hbs`, sends a custom HMR event, re-runs `Application.render(true)`. Compensates for alexlafroscia's partial-HMR gaps; pattern adopted by recent FoundryVTT Vite setups. | (internal) |

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
| **pnpm 10+ + Corepack** | Package manager + workspaces. Pin via `"packageManager": "pnpm@10.x"` in root `package.json`. | https://pnpm.io |
| **pnpm catalogs** | 2026-native cross-workspace dependency pinning (`pnpm-workspace.yaml > catalog`). | https://pnpm.io/catalogs |
| **Changesets** | Versioning + changelog | https://github.com/changesets/changesets |

> pnpm 10 (Jan 2026) made OIDC trusted publishing first-class; pnpm 11 (Apr 2026) dropped the npm-CLI publish fallback. Bun does not yet support npm OIDC trusted publishing (issue `oven-sh/bun#22423`, open since 2025-09); `bun publish --filter` is broken for monorepos and changesets does not resolve `workspace:*` strings under Bun. Bun stays as an optional local runtime (faster `bun test` / scripts) but is not the workspace driver or publisher. After the late-2025 supply-chain incidents (Shai-Hulud variants, Bitwarden CLI hijack), trusted publishing + provenance attestations are now a baseline trust signal — making this a v0.1 requirement, not v1.0.

### Quality

| Technology | Role | Link |
|---|---|---|
| **Biome** | Linting + formatting (single binary, no plugin sprawl). v2.4 (Feb 2026), 423+ lint rules, type-aware checks. | https://biomejs.dev |
| **Oxlint** *(optional, CI fast-fail layer only)* | Linting-only, ~2x faster than Biome on its ~300 rules. v1.0 stable since Aug 2025; production users include Shopify, Mercedes-Benz, Airbnb. Not a Biome replacement (no formatter, narrower rule coverage, limited auto-fix). | https://github.com/oxc-project/oxc |
| **Vitest** | Unit testing. v4.1 (Mar 2026); v5 beta (Apr 2026). | https://vitest.dev |
| **`happy-dom`** | DOM env for sheet-render tests (2-4× faster than jsdom). **Caveat:** no release since v20.9.0 (Apr 2025) — flag for slow maintenance. Fall back to `jsdom` per-suite via `// @vitest-environment jsdom` if Foundry-specific DOM gaps surface. | https://github.com/capricorn86/happy-dom |
| **Quench (via FVTT)** | In-world integration testing | https://github.com/Ethaks/FVTT-Quench |
| **GitHub Actions** | CI/CD | https://docs.github.com/en/actions |

### 5.1 Publishing quality toolkit

These are required to ship a high-quality public TypeScript SDK in 2026. All are wired into CI as gates (or warnings, see §6).

| Tool | Purpose | Verified status (May 2026) |
|---|---|---|
| **`publint`** ([publint.dev](https://publint.dev)) | Validates `package.json` `exports`/`types`/`main`/`module` correctness | v0.3.20 (May 2026), recent multi-month cadence |
| **`@arethetypeswrong/cli` (attw)** ([repo](https://github.com/arethetypeswrong/arethetypeswrong.github.io)) | Validates `.d.mts` resolves under Node ESM, bundlers, and `nodenext` | v0.18.1, active |
| **`knip`** ([knip.dev](https://knip.dev)) | Detects unused exports/files across the monorepo | v6.12.2 (May 2025), recommended over deprecated `ts-prune` |
| **`syncpack`** ([repo](https://github.com/JamieMason/syncpack)) | Keeps shared dependency versions in sync; auto-migrates to pnpm catalogs | **v15.0.0 (May 2026)** — adds full pnpm/Bun catalog support |
| **`lefthook`** ([repo](https://github.com/evilmartians/lefthook)) | Git hooks (pre-commit Biome on staged, pre-push typecheck). Parallel execution. | v2.1.6 (Apr 2026) |
| **`tsx`** ([repo](https://github.com/privatenumber/tsx)) | Running TS scripts in `scripts/`. ~48ms startup vs ts-node's ~480ms. | v4.21.0 (Nov 2025). Track Node `--experimental-strip-types` (Node 22.18+) as eventual replacement for decorator-free scripts. |
| **npm Trusted Publishing (OIDC)** ([docs](https://docs.npmjs.com/trusted-publishers/)) | Auto-generated provenance attestation via GitHub OIDC. Replaces long-lived `NPM_TOKEN`. | GA since 2025-07-31. Requires npm CLI ≥ 11.5.1, Node ≥ 22.14.0, per-package config on npmjs.com. |
| **`changeset-bot` (GH App)** ([repo](https://github.com/changesets/bot)) | Comments on PRs missing changesets | Actively maintained; non-blocking. Fallback: `pnpm changeset status --since=origin/main` in CI for forks where the bot can't comment. |

### 5.2 CSS pipeline

**Default:** vanilla CSS + PostCSS (`autoprefixer`, `postcss-nesting`, `postcss-custom-media`). Foundry v13's minimum runtime is Chromium 122, so native CSS nesting, `@layer`, `:has()`, custom properties, and `@scope` (Baseline since Jan 2026) are all available without polyfills. **Sass** is supported when the consumer installs it (Vite native), but is not a peer dependency.

**Tailwind:** documented as opt-in recipes in `docs/recipes/`, **not bundled**:

- `docs/recipes/tailwind-v3.md` — primary recipe. Tailwind v3 is stable, well-tested, and works cleanly under FoundryVTT's Electron + cascade-layer setup.
- `docs/recipes/tailwind-v4.md` — **experimental** until known issues land: `electron-vite#741` (Tailwind v4 broken in Electron via `@tailwindcss/vite`), `tailwindcss#16531`/`#17234` (hover/render bugs on certain Chromium variants).

`@vttforge/styles` is a separate package that provides the base layer using cascade layers (see §6 and §7.5).

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
│   │   │   ├── tokens.css           # CSS custom properties (--vttf-*); consume Foundry CONST.CSS_THEMES vars
│   │   │   ├── reset.css            # minimal Foundry-aware reset
│   │   │   ├── base.css             # sheet layout primitives
│   │   │   ├── components.css      # tabs, drag-drop, inputs, buttons, dialogs
│   │   │   ├── themes/
│   │   │   │   ├── light.css
│   │   │   │   ├── dark.css
│   │   │   │   ├── high-contrast.css
│   │   │   │   └── auto.css         # respects prefers-color-scheme
│   │   │   ├── index.css            # tokens + reset + base + components (no theme)
│   │   │   └── styles.layer.css     # Mantine-style: same content pre-wrapped in @layer vttforge
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
│       ├── tailwind-v3.md          # Primary Tailwind recipe (stable)
│       └── tailwind-v4.md          # Experimental — pending Electron + render bug fixes
├── .github/
│   └── workflows/
│       ├── ci.yml                  # PR gate: lint, typecheck, test, build, package-quality, knip
│       ├── changesets.yml          # Opens "Version Packages" PR (no id-token)
│       ├── publish.yml             # Runs on Version PR merge; OIDC trusted publish (id-token: write)
│       └── canary.yml              # Opt-in preview publishes (v0.2+)
├── .changeset/
├── turbo.json
├── pnpm-workspace.yaml             # Includes catalog: section pinning shared deps
├── package.json                    # "packageManager": "pnpm@10.x"
├── biome.json
├── lefthook.yml
├── PRD.md
├── README.md
├── CHANGELOG.md
└── CONTRIBUTING.md
```

> The `changesets.yml` + `publish.yml` split (instead of a single workflow) is a workaround for `changesets/action#515`: combining the Version PR creation and the OIDC publish in one workflow has known token/permission frictions. This is the 2026 standard pattern.

### CI / release pipeline

Setup shared by all workflows: `actions/setup-node@v4` with `node-version: '22.14'` (or higher) + Corepack + **`pnpm/action-setup@v6`** (omit `version` input — it reads from the `packageManager` field). Cache `~/.pnpm-store` and use Turbo remote cache.

**`ci.yml`** (PR + push to `main`) — required jobs:

- `lint` → `biome ci . && pnpm syncpack lint`
- `typecheck` → `turbo run typecheck`
- `test` → `turbo run test` (Node 22 + Node 24 matrix; Node 20 dropped — npm trusted publishing requires Node ≥ 22.14.0 anyway)
- `build` → `turbo run build`
- `package-quality` → `turbo run publint && turbo run attw` (depends on `build`)
- `knip` → non-blocking until v0.1.0, blocking after

**`changesets.yml`** (push to `main`):

- Single job using `changesets/action@v1` to open/update the "Version Packages" PR
- Permissions: `contents: write`, `pull-requests: write` (no `id-token` here)

**`publish.yml`** (triggered when the "Version Packages" PR merges, or on tag push):

- Runs the same `package-quality` gates as `ci.yml` first — never publish a broken package
- Permissions: `contents: write`, `id-token: write` (the `id-token` is what enables OIDC trusted publishing)
- Publish: `pnpm publish -r --access public --no-git-checks`
- **No `--provenance` flag** — under OIDC trusted publishing, npm auto-generates the SLSA attestation
- **No `NPM_TOKEN`** — authentication is via OIDC. Configure each `@vttforge/*` package's "Trusted Publisher" on npmjs.com pointing to this repo + workflow.
- Watch out: `npm/cli#8976` — scoped packages can fail with E404 under OIDC if the trusted-publisher config is incomplete. Validate by publishing a test scope first.

**Branch protection on `main`:** PR review (1), required checks (`lint`, `typecheck`, `test`, `build`, `package-quality`), linear history, no force pushes. Once v0.1.0 ships: also require `knip` and signed commits.

> All version pins in this section are verified against current GitHub release pages (May 2026): `pnpm/action-setup@v6.0.6` (2026-05-08), `changesets/action@v1.8.0` (2026-05-07). npm Trusted Publishing GA per [GitHub changelog 2025-07-31](https://github.blog/changelog/2025-07-31-npm-trusted-publishing-with-oidc-is-generally-available/).

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

**Cascade Layer architecture — Foundry-aware.**

Foundry v13 owns a fixed top-level layer order:

```
@layer reset, variables, elements, blocks, applications, compatibility, layouts, system, modules, exceptions;
```

Foundry **automatically wraps** any CSS your `system.json` `styles` field references in the `system` layer (or `modules` for modules). This is documented in the Foundry community wiki and confirmed by Foundry GitHub issue #6842.

**Consequence for VTTForge:** we must NOT define top-level `@layer foundry` or `@layer system` — those names are owned by Foundry. Internal layering uses a vendored prefix:

```css
/* @vttforge/styles/index.css declares its OWN sub-layer order */
@layer vttforge.reset, vttforge.tokens, vttforge.base, vttforge.components;
```

When a consumer imports VTTForge styles via their `system.json`, Foundry wraps the whole bundle in the `system` layer:

```
@layer system {
  @layer vttforge.reset, vttforge.tokens, vttforge.base, vttforge.components;
  /* …vttforge sub-layers populated here… */
  /* …consumer's own un-prefixed system CSS here, beating vttforge.* by source order… */
}
```

The consumer's own system CSS lands in the same `system` layer alongside ours but is unlayered relative to our sub-layers, so it wins by source order — exactly the desired behavior. **No `!important` required.**

For consumers who want stricter ordering control, `@vttforge/styles/styles.layer.css` ships the same content pre-wrapped in a `@layer vttforge { ... }` block (Mantine pattern).

**Recommended consumption — explicit:**

```css
/* my-system/styles/main.css */
@import "@vttforge/styles";              /* tokens + reset + base + components */
@import "@vttforge/styles/themes/auto.css"; /* opt-in theme */

/* your system styles here automatically beat vttforge.* by source order */
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

- `tokens.css` — design tokens via `--vttf-*` custom properties (color, spacing 4/8/12/16/24/32/48, type scale, radii, shadows, motion). Tokens **consume Foundry's Theme V2 variables** where they exist:
  ```css
  :root {
    --vttf-color-text: var(--color-text-primary, #1d1d1d);
    --vttf-color-bg:   var(--background, #f4f1eb);
    /* …etc, mapping to CONST.CSS_THEMES exposed by Foundry v13 */
  }
  ```
  This means VTTForge automatically inherits Foundry's light/dark/fantasy/sci-fi themes without having to ship our own — consumers can override by reassigning `--vttf-*` in their own theme.
- `reset.css` — minimal reset that respects Foundry's existing baseline.
- `base.css` — `.vttf-window`, `.vttf-parts`, `.vttf-tab-bar`, `.vttf-tab-panel`.
- `components.css` — drag-drop (`.vttf-drop-target`, `.vttf-dragging`, `.vttf-drop-valid/invalid`), tabs paired with `static TABS` from `BaseActorSheet`, opt-in `.vttf-input` form baseline.
- `themes/{light,dark,high-contrast,auto}.css` — opt-in theme overrides via `.vttf-theme-*` class scopes.
- `styles.layer.css` — same content as `index.css` pre-wrapped in `@layer vttforge` (Mantine pattern).

The plugin writes the resolved CSS path into the system manifest's `styles` field during `vttforge build`.

> **v12 → v13 migration warning** to surface in `docs/migrating-from-v12.md`: Foundry v13 itself introduced cascade layers, which broke many existing v12 systems' `!important`-laden CSS. Consumers migrating from v12 should expect to revisit their CSS specificity assumptions when adopting `@vttforge/styles`.

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

- [ ] Turborepo monorepo skeleton (`packages/*`, `turbo.json`, root `package.json` with **pnpm 10+ workspaces** + Corepack via `"packageManager"` field)
- [ ] `pnpm-workspace.yaml` with `catalog:` section pinning shared deps (TS, Vite, Vitest, Biome, etc.)
- [ ] `tsdown` configured per package for `.mjs` + `.d.mts` output, with explicit `external` and `dts.resolve` config to dodge `rolldown-plugin-dts#199`
- [ ] Biome config (lint + format)
- [ ] Changesets setup with `changeset-bot` GH App on the repo
- [ ] `lefthook.yml` with pre-commit Biome and pre-push typecheck
- [ ] `syncpack` v15+ config (auto-migrates to pnpm catalogs)
- [ ] TypeScript base config (strict, ESM-only, `.mts` output)
- [ ] `fvtt-types` pinned to a `main` git SHA (not an npm tag)
- [ ] CI: `.github/workflows/ci.yml` with `lint`, `typecheck`, `test`, `build`, `package-quality` (publint + attw), `knip`
- [ ] CI: `.github/workflows/changesets.yml` (Version PR) + `.github/workflows/publish.yml` (OIDC trusted publish — no `NPM_TOKEN`, no `--provenance` flag)
- [ ] Configure each `@vttforge/*` package's Trusted Publisher on npmjs.com
- [ ] `@vttforge/core`:
  - [ ] `f` fields alias re-export
  - [ ] `BaseTypeDataModel`
  - [ ] `SystemConfig`
  - [ ] `BaseActorSheet` (DragDrop, TABS, onEditImage, _onDrop)
  - [ ] `BaseItemSheet`
  - [ ] `createMigrationRunner`
  - [ ] `registerSystem`
- [ ] `@vttforge/styles`:
  - [ ] `tokens.css` (consumes Foundry `CONST.CSS_THEMES` vars), `reset.css`, `base.css`, `components.css`, `index.css`
  - [ ] Sub-layer wiring: `@layer vttforge.reset, vttforge.tokens, vttforge.base, vttforge.components;` (NO top-level `foundry` or `system` — those are owned by Foundry v13)
  - [ ] `styles.layer.css` Mantine-style variant pre-wrapped in `@layer vttforge`
  - [ ] Opt-in themes (`light`, `dark`, `high-contrast`, `auto`)
- [ ] `examples/simple-system` working demo (consumes `@vttforge/core` + `@vttforge/styles`)
- [ ] Migrate `ordemparanormal` to use all of the above

### 📦 v0.2.0 — Build tooling

- [ ] `@vttforge/vite-plugin`:
  - [ ] HMR for `.hbs` templates
  - [ ] CSS pipeline (PostCSS preset; Sass detection; `injectBaseStyles` option)
  - [ ] Manifest sync (`system.json` / `module.json`) including `styles` field rewrite during dev
  - [ ] Foundry `Data/` symlink helper
- [ ] `docs/recipes/tailwind-v3.md` (primary), `docs/recipes/tailwind-v4.md` (experimental, pending `electron-vite#741` resolution)
- [ ] `docs/migrating-from-v12.md` — cascade-layer specificity changes when moving from v12
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

### Resolved in v1.2 / v1.3

- **Package distribution** — scoped `@vttforge/*` packages on npm. ✅
- **ESM-only vs dual CJS/ESM** — ESM-only (Node 20+ can require ESM; CJS no longer needed for libraries in 2026). ✅
- **Library bundler** — `tsdown` (Vite docs themselves point library authors here; tsup formally deprecated). ✅
- **Package manager** — pnpm 10+ + Corepack. Bun lacks npm OIDC support and reliable workspace publishing. ✅
- **`fvtt-types` install method** — git SHA from `main`, not npm tag. ✅
- **CSS — base styles location** — separate `@vttforge/styles` package. ✅
- **CSS — scoping strategy** — Cascade Layers using vendored `vttforge.*` sub-layers only; defer top-level layer ordering to Foundry v13's built-in scheme. ✅
- **CSS — Tailwind** — not bundled. v3 primary recipe, v4 experimental. ✅
- **CSS — pipeline default** — vanilla CSS + PostCSS, Sass opt-in. ✅
- **CSS — Foundry theme integration** — `--vttf-*` tokens consume Foundry's `CONST.CSS_THEMES` variables. ✅
- **Trusted publishing** — required from v0.1 (post-Shai-Hulud baseline), via npm OIDC. No `NPM_TOKEN`. ✅
- **CI workflow shape** — split `changesets.yml` + `publish.yml` per `changesets/action#515`. ✅

### Still open

1. **`registerSystem` placement** — should it wrap `Hooks.once("init")` itself (caller just calls `registerSystem()` at module top level) or require the caller to be inside a hook? Wrapping is cleaner DX but hides the lifecycle. **Lean: explicit hook for now, magic later.**
2. **Vite as a hard CLI dependency** — forces Vite on everyone using `vttforge dev/build`. Consider making it optional (bring-your-own bundler) with the plugin as an add-on. **Lean: Vite-first for v0.x, abstract in v1.0.**
3. **Decorator strategy** — TC39 stage 3 decorators vs experimental. Foundry community ships ESM, but decorators add transpilation requirements. **Lean: skip decorators for v0.1, revisit after stage 3 stabilizes in TS 5.5+.**
4. **Patreon / sponsorship** — should VTTForge accept GitHub Sponsors / Patreon to fund development? Affects how the project is positioned (pure community vs sustainable side-project). **Lean: enable sponsors at v0.1 release, no required tiers.**
5. **`@scope` adoption** — `@scope` became Baseline in Jan 2026 (Firefox 146). It solves component-level isolation differently from `@layer` (proximity vs. cascade priority). Defer to v0.2+ — test interaction with Foundry's existing layer hierarchy before adopting.
6. **Citty release cadence** — Citty's release cadence in 2026 is slow. If it stalls, Commander v13 (now with first-class TS support) is the safe escape hatch. Re-evaluate at v1.0.
7. **`happy-dom` maintenance** — no release since v20.9.0 (Apr 2025). If sheet tests run into Foundry-specific DOM gaps, fall back to jsdom per-suite. Evaluate at v0.2 whether to switch defaults.
8. **`tsdown` DTS+peer-deps** — `rolldown-plugin-dts#199` unresolved as of Mar 2026. Run a smoke-test consumer with `skipLibCheck: false` early in v0.1 to surface any TS2307 issues before publishing.

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
