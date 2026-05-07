# FoundryVTT SDK — Product Requirements Document

**Version:** 1.0.0
**Date:** 2026-05-04
**Author:** fcsouza
**Status:** Draft

---

## Overview

A full-stack developer SDK for building FoundryVTT v13+ systems and modules. The SDK eliminates boilerplate, introduces declarative APIs, and ships a CLI that scaffolds and builds projects from scratch.

The first consumer of this SDK is **Ordem Paranormal RPG** (`ordemparanormal_fvtt`) — a production FoundryVTT system. Every API decision must be validated against that codebase before generalization.

---

## Problem Statement

Building FoundryVTT systems and modules requires:

1. **Imperative, scattered initialization** — settings, sheets, data models, and document classes are registered via `Hooks.once("init")` with hardcoded string IDs
2. **Repeated structural boilerplate** — every sheet copy-pastes 36-line `DragDrop` wiring, 50-line `_getTabs()` switches, and identical `_onEditImage` handlers
3. **No type inference from schema** — developers define a `TypeDataModel` schema and then manually write a matching TypeScript interface (double work)
4. **No project scaffold** — every new system or module starts from scratch, creating inconsistent structures across the community
5. **No HMR for Handlebars templates** — editing `.hbs` files requires reloading the entire browser + canvas

**Confirmed pain points in `ordemparanormal` (pre-SDK baseline):**

| Boilerplate Pattern | Occurrences | Lines Wasted |
|---|---|---|
| `#createDragDropHandlers()` verbatim copy | 3 sheets | ~108 lines |
| `_getTabs()` switch tables | 3 sheets | ~180 lines |
| `game.settings.get("ordemparanormal", ...)` hardcoded ID | ~10 calls | risk of typo |
| `const fields = foundry.data.fields` per-method | 14 occurrences | — |
| Stub `migrateData(data) { return super.migrateData(data) }` | 8 data models | ~24 lines |
| `#onEditImage` FilePicker copy | 2 sheets | ~30 lines |
| Settings getters duplicated on Actor + Sheet | 4 × 2 | ~24 lines |
| `_onDrop` switch handler copy | 2 sheets | ~60 lines |

---

## Goals

### Primary Goals (v1.0)

1. **`@vttforge/core`** — Runtime utilities that eliminate the boilerplate patterns above with zero lock-in (the output is plain `.mjs` files Foundry loads directly)
2. **`@vttforge/cli`** — `vttforge init`, `vttforge dev`, `vttforge build` commands
3. **`@vttforge/vite-plugin`** — HMR for `.hbs` templates, manifest auto-sync, Foundry `Data/` symlink
4. **Migrate `ordemparanormal` to the SDK** — validates every API with a real production system

### Secondary Goals (v1.x)

5. **Schema-to-TypeScript inference** — derive TS interfaces from `defineSchema()` automatically (like Zod)
6. **Decorator API** — `@SystemSetting`, `@DocumentSheet` class decorators for registration
7. **`@vttforge/testing`** — Quench test helpers for system/module unit testing
8. **Published to npm** — `bun add @vttforge/core`

### Non-Goals

- Wrapping the full FoundryVTT canvas API (PIXI.js layers, tokens, lighting)
- Supporting FoundryVTT v12 or below
- Building a UI component library (Handlebars/Svelte components)
- Replacing `libWrapper` or `socketlib`

---

## Tech Stack

### Runtime (`@vttforge/core`, `@vttforge/vite-plugin`)

| Technology | Role | Link |
|---|---|---|
| **TypeScript 5.x** | Source language | https://www.typescriptlang.org |
| **ESM output (`.mjs`)** | Foundry requires ES modules | https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules |
| **`@league-of-foundry-developers/foundry-vtt-types`** | Type definitions for the Foundry API | https://github.com/League-of-Foundry-Developers/foundry-vtt-types |
| **Vite 6** | Bundler for packages + dev server | https://vitejs.dev |
| **`vite-plugin-handlebars`** | HMR for `.hbs` templates | https://github.com/nicktindall/vite-plugin-handlebars |

### CLI (`@vttforge/cli`)

| Technology | Role | Link |
|---|---|---|
| **Node.js / Bun** | Runtime | https://bun.sh |
| **Citty** | CLI framework (lightweight, typed) | https://github.com/unjs/citty |
| **Giget** | Template scaffolding (`degit`-like) | https://github.com/unjs/giget |
| **Prompts / Clack** | Interactive prompts | https://github.com/bombshell-dev/clack |

### Monorepo

| Technology | Role | Link |
|---|---|---|
| **Turborepo** | Task pipeline + remote caching | https://turbo.build |
| **Bun workspaces** | Package manager | https://bun.sh/docs/install/workspaces |
| **Changesets** | Versioning + changelog | https://github.com/changesets/changesets |

### Quality

| Technology | Role | Link |
|---|---|---|
| **Vitest** | Unit testing | https://vitest.dev |
| **Quench (via FVTT)** | In-world integration testing | https://github.com/Ethaks/FVTT-Quench |
| **Biome** | Linting + formatting | https://biomejs.dev |
| **GitHub Actions** | CI/CD | https://docs.github.com/en/actions |

---

## Architecture

### Repository Structure

```
vttforge/                            # Turborepo monorepo
├── packages/
│   ├── core/                        # @vttforge/core
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
│   └── vite-plugin/                # @vttforge/vite-plugin
│       └── src/
│           ├── index.mts
│           ├── hbs-hmr.mts         # HMR for .hbs files
│           └── manifest-sync.mts   # Auto-sync system.json / module.json
├── examples/
│   ├── simple-system/              # Minimal system using the SDK
│   └── simple-module/              # Minimal module using the SDK
├── turbo.json
├── package.json
└── CONTRIBUTING.md
```

---

## API Design

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
    attributes: { group: "primary", icon: "fa-user",    label: "MY_SYSTEM.Attributes" },
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

---

## Migration Plan: `ordemparanormal` → SDK

This is the first project to adopt the SDK. The migration is phased to de-risk each change.

### Phase 1 — Core runtime (no CLI yet)

1. Publish `@vttforge/core` v0.1 (or copy `src/` into `module/sdk/`)
2. Replace all 8 data models with `BaseTypeDataModel` — remove stub `migrateData`, use `f.*` alias
3. Refactor `actor-sheet.mjs`, `item-sheet.mjs`, `threat-sheet.mjs` to extend `BaseActorSheet`/`BaseItemSheet` — remove DragDrop, `_getTabs`, `_onEditImage`, `_onDrop` copies
4. Introduce `SystemConfig` — replace all `game.settings.get("ordemparanormal", ...)` calls

Verification: run Quench tests, visually test all sheets in Foundry.

### Phase 2 — `registerSystem`

5. Replace `Hooks.once("init")` registration block in `ordemparanormal.mjs` with `registerSystem()`

Verification: full system boot, character creation, item rolls.

### Phase 3 — Vite + HMR (optional but valuable)

6. Add `@vttforge/vite-plugin` — configure HMR for `.hbs` templates
7. Run `vttforge dev` for local development

---

## Reference Links

### FoundryVTT Official

- API docs v13: https://foundryvtt.com/api/v13/
- Package submission: https://foundryvtt.com/packages/submit
- Official CLI: https://github.com/foundryvtt/foundryvtt-cli
- FoundryVTT Discord (dev channel): https://discord.gg/foundryvtt

### Community Resources

- League of Foundry Developers (type defs, templates): https://github.com/League-of-Foundry-Developers
- `foundry-vtt-types`: https://github.com/League-of-Foundry-Developers/foundry-vtt-types
- Module template (TS + Vite): https://github.com/League-of-Foundry-Developers/FoundryVTT-Module-Template
- Quench (in-game testing): https://github.com/Ethaks/FVTT-Quench
- libWrapper: https://github.com/ruipin/fvtt-lib-wrapper
- socketlib: https://github.com/manuelVo/foundryvtt-socketlib

### Comparable Abstractions (Inspiration)

- Zod (schema-to-type inference pattern): https://zod.dev
- Citty (CLI framework): https://github.com/unjs/citty
- Unplugin (Vite/Rollup plugin boilerplate): https://github.com/unjs/unplugin

### This Project (First SDK Consumer)

- `ordemparanormal` system: https://github.com/fcsouza/ordemparanormal_fvtt
- Ordem Paranormal RPG: https://www.jamboeditora.com.br/produto/ordem-paranormal-rpg/

---

## Roadmap

### v0.1 — Internal (validate with `ordemparanormal`)
- [ ] `BaseTypeDataModel` + `f` fields alias
- [ ] `BaseActorSheet` (DragDrop, TABS, onEditImage, _onDrop)
- [ ] `BaseItemSheet`
- [ ] `SystemConfig`
- [ ] `createMigrationRunner`
- [ ] `registerSystem`
- [ ] Migrate `ordemparanormal` to use all of the above

### v0.2 — Published package
- [ ] Turborepo monorepo setup
- [ ] `@vttforge/core` published to npm
- [ ] TypeScript declarations + `d.mts` output
- [ ] `examples/simple-system` working demo

### v0.3 — Build tooling
- [ ] `@vttforge/vite-plugin` (HMR for `.hbs`, manifest sync, Foundry symlink)
- [ ] `vttforge dev` CLI command

### v0.4 — CLI scaffolding
- [ ] `vttforge init` — system scaffold
- [ ] `vttforge init` — module scaffold
- [ ] `vttforge build` — bundle + zip

### v1.0 — Schema inference + decorators
- [ ] Infer TypeScript types from `defineSchema()` (no double-typing)
- [ ] `@SystemSetting` decorator
- [ ] `@DocumentSheet` decorator
- [ ] Stable public API + semver guarantee

---

## Success Criteria

1. The `ordemparanormal` migration removes **400+ lines of boilerplate** with no functionality regression (Quench tests pass, all sheets work in Foundry)
2. A new system can be scaffolded and loaded in Foundry in under 5 minutes using `vttforge init`
3. Editing a `.hbs` template hot-reloads in the browser without reloading the canvas
4. Zero FoundryVTT global references during module `import` — all deferred to `Hooks.once("init")` or function bodies
5. The SDK ships with full TypeScript declarations

---

## Open Questions

1. **Package distribution** — publish to npm as `@vttforge/*` or a single `vttforge` package? Scoped packages are cleaner but require npm org setup.
2. **ESM-only vs. dual CJS/ESM** — Foundry requires ESM; CLI must run on Node, which handles ESM fine. ESM-only is safe.
3. **`registerSystem` placement** — should it wrap `Hooks.once("init")` itself (caller just calls `registerSystem()` at module top level) or require the caller to be inside a hook? Wrapping is cleaner DX but hides the lifecycle.
4. **Vite as a hard CLI dependency** — forces Vite on everyone using `vttforge dev/build`. Consider making it optional (bring-your-own bundler) with the plugin as an add-on.
