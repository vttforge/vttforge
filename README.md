<div align="center">

<img src="brand/logo-512.png" alt="" width="88" height="88" />

# VTTForge

**An SDK and CLI for building [Foundry VTT](https://foundryvtt.com) v13+ systems and modules.**

[![npm version](https://img.shields.io/npm/v/@vttforge/core.svg?style=flat-square)](https://www.npmjs.com/package/@vttforge/core)
[![License](https://img.shields.io/npm/l/@vttforge/core.svg?style=flat-square)](LICENSE)
[![FoundryVTT](https://img.shields.io/badge/FoundryVTT-v13%2B-orange?style=flat-square)](https://foundryvtt.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org)

[Documentation](https://vttforge.dev/docs/) · [Getting started](https://vttforge.dev/docs/guide/getting-started) · [API reference](https://vttforge.dev/docs/reference/) · [Roadmap](#roadmap) · [Report a bug](https://github.com/vttforge/vttforge/issues)

</div>

---

> **Status:** published on npm and usable today. Every package is on its own 0.x line, so a caret pins the minor and a minor bump is a breaking change. The versioning and Node support story is in [STABILITY.md](STABILITY.md).

## Start here

```bash
pnpm create vttforge my-system --type system --lang ts
cd my-system
pnpm build
```

That scaffolds a Foundry-loadable system, installs it, and builds a `dist/` plus a release zip with the manifest at the root, which is what foundryvtt.com expects. Every prompt is also a flag, so the same line runs in CI with `--yes`.

`npx @vttforge/cli init` does the same thing if you would rather not go through `create`.

Then point Foundry at it:

```bash
pnpm dev
```

This builds, symlinks `dist/` into your Foundry data directory, and watches. Save a template and the open sheet redraws in place, with no page reload. The first run asks where Foundry keeps its data and remembers the answer; if Foundry runs in a container and cannot follow a symlink, it prints the compose mount to use instead.

## Docs

The whole guide is at **[vttforge.dev/docs](https://vttforge.dev/docs/)**.

- **[Getting started](https://vttforge.dev/docs/guide/getting-started).** Scaffold a project, point Foundry at it, build a release zip.
- **[Data models](https://vttforge.dev/docs/guide/data-models).** One schema that types itself, and what each field class quietly defaults to.
- **[Sheets](https://vttforge.dev/docs/guide/sheets).** The bases, the drop hooks, and why every sheet needs an id.
- **[Modules](https://vttforge.dev/docs/guide/modules).** Namespaced sub-types, enrichers, and what a module may not touch.
- **[Settings and migrations](https://vttforge.dev/docs/guide/settings-and-migrations).** `SystemConfig` and the migration runner.
- **[The dev loop](https://vttforge.dev/docs/guide/dev-loop).** What reloads in place and what does not.
- **[Testing](https://vttforge.dev/docs/guide/testing).** `withMockFoundry` in Vitest, Quench for what a mock cannot answer.
- **[CLI reference](https://vttforge.dev/docs/guide/cli).** Every command, and every rule `vttforge audit` checks.

Also on the site: the [API reference](https://vttforge.dev/docs/reference/) generated from the sources, the [error catalogue](https://vttforge.dev/docs/errors/), the [recipes](https://vttforge.dev/docs/recipes/), and the [stability policy](https://vttforge.dev/docs/stability).

## Why this exists

I have run Foundry games for years, and every major version I watch the same thing happen. A module I depend on stops working. Sometimes the author ports it and it costs them weeks. More often the repository goes quiet, someone opens an issue asking whether it will be updated, and nobody answers.

What breaks is almost never the interesting part. It is the sheet plumbing, the registration boilerplate, the class that moved namespace. The rules of the game the author actually cared about are still correct.

VTTForge exists to hold that plumbing in one place. When Foundry moves it, the change lands here, and a system or module built on it updates a dependency instead of rewriting a sheet.

That is also why several things work the way they do. A sheet is registered under an id you choose, so the sheet your readers picked survives your next release. Migrations are versioned and GM-gated, so their worlds survive your schema changes. `vttforge audit` looks for the v13 breakages that fail silently, which is what strands a module after a version bump. And every push boots a real Foundry and drives the example through it, because the question that matters is whether it still loads.

**If this project ever goes quiet, you are not stranded.** The build output is plain ES modules that Foundry loads natively, with no runtime shim and no framework to unwind. Delete the dependency and your code is still your code. A tool meant to keep other people's work alive has no business being the thing that traps it.

## What it takes off your hands

If you have built a Foundry system, you have written these by hand:

```ts
#createDragDropHandlers() { /* the same 36 lines, in every sheet */ }

async _prepareContext(options) {
  const context = await super._prepareContext(options);
  context.tabs = { primary: this._prepareTabs("primary") };  // every group, every sheet
  return context;
}

async _onDropItem(event, data) {
  const item = await fromUuid(data.uuid);  // the fromUuid ceremony, again
}
```

VTTForge declares them instead:

```ts
import { BaseActorSheet, fields, type InferSchema } from "@vttforge/core";

class CharacterSheet extends BaseActorSheet() {
  static PARTS = { /* your templates */ };
  static TABS = { /* declared once; context.tabs is filled in for you */ };
  static DRAG_DROP = [{ dragSelector: ".item[draggable=true]" }];

  // fromUuid already done. Return undefined to fall through to Foundry.
  override async onDropItem(item, event) { /* … */ }
}
```

And one `defineSchema()` drives both runtime validation and your types:

```ts
class CharacterData extends BaseTypeDataModel(defineCharacterSchema) {}

type CharacterSystem = InferSchema<ReturnType<typeof defineCharacterSchema>>;
// → { level: number; biography: string; hp: { value: number; max: number } }
```

Where Foundry already does something well, such as `editImage` on `DocumentSheetV2` or the `_getTabs()` state machine, VTTForge leaves it alone.

## What is actually in the box

Most of these exist because something failed quietly in a real world, not because the API looked tidy.

| Package | What it does |
|---|---|
| [`@vttforge/core`](https://www.npmjs.com/package/@vttforge/core) | `registerSystem` / `registerModule`, sheet and enricher registration, `BaseTypeDataModel` + `InferSchema<T>`, `BaseActorSheet` / `BaseItemSheet` / `BaseDocumentSheet` / `BaseApplication`, `SystemConfig`, `createMigrationRunner`, and the `VTTF-NNNN` error catalogue |
| [`@vttforge/cli`](https://www.npmjs.com/package/@vttforge/cli) | `vttforge init` / `dev` / `build` / `audit`: scaffolding, the symlink-and-watch dev loop, the release zip, and a manifest linter |
| [`@vttforge/vite-plugin`](https://www.npmjs.com/package/@vttforge/vite-plugin) | The build contract: browser-ESM output with no hashing, CSS bundled, manifest copied under Foundry's filename with `version` and entry paths rewritten |
| [`@vttforge/styles`](https://www.npmjs.com/package/@vttforge/styles) | The Forge design system: W3C DTCG tokens compiled to CSS, `.vttf-*` primitives, sheet primitives, opt-in themes over cascade layers |
| [`@vttforge/testing`](https://www.npmjs.com/package/@vttforge/testing) | `withMockFoundry` for Vitest, and a Quench half for what a mock cannot answer |
| [`@vttforge/types`](https://www.npmjs.com/package/@vttforge/types) | The Foundry surface the bases stand on: `ApplicationV2Members`, `DocumentSheetV2Members`, `VttforgeClass` |
| [`@vttforge/dev-module`](https://www.npmjs.com/package/@vttforge/dev-module) | The in-world half of the dev loop, installed for you by `vttforge dev` |
| [`create-vttforge`](https://www.npmjs.com/package/create-vttforge) | So `pnpm create vttforge` works |

### Three things it stops you getting wrong

**A sheet key that survives your next build.** Foundry keys a registered sheet by `${package id}.${class name}` and saves that key on every document whose owner picked the sheet. A minifier renames classes, so the key moves and the reader's choice silently falls back to the default. Registering through `sheets` with an explicit `id` writes the key down instead of deriving it.

**An enricher that actually fires.** `CONFIG.TextEditor.enrichers` takes an entry and does nothing with it in four ways, none of which say so. `onRender` without an `id` never runs, a duplicate `id` loses to whoever registered first, and a pattern without the `g` flag throws inside someone's chat message. Registering through `enrichers` namespaces the id and checks the rest up front.

**A sheet that renders something other than a template.** `BaseActorSheet` mixes in Handlebars, which is right for `static PARTS` and wrong for a canvas, an embedded PDF, or a framework mount. Using it for one of those renders nothing, with a clean console. `BaseDocumentSheet` is the same plumbing without the mixin.

## Try the example

The repo ships a working Foundry v13 system. Requires Docker and a [foundryvtt.com](https://foundryvtt.com) license:

```bash
git clone https://github.com/vttforge/vttforge && cd vttforge
corepack enable && pnpm install
pnpm build
cp .env.example .env                             # FOUNDRY_LICENSE_KEY / USERNAME / PASSWORD
docker compose -f docker-compose.dev.yml up      # → http://localhost:30000
```

Create a world on **VTTForge Example System** and add a Character. The sheet renders the reference layout: quick stats, four tabs, an ability grid with roll buttons, an items list with kind pills. The demo migration runs at world load.

## Design system

The **Forge theme**: warm-dark surfaces, an ember accent, a `{ d20 }` mark, a 4-pt grid. It is live at [vttforge.dev/design-system](https://vttforge.dev/design-system/).

- **Tokens.** `packages/styles/tokens.json` (W3C DTCG) compiles to `dist/tokens.css`. Three blocks: Forge, `[data-theme="light"]`, and an opt-in `[data-theme="foundry"]` that follows the GM's Theme V2 setting.
- **Primitives.** Buttons, badges, code blocks, form controls, tabs and the `.sh-*` sheet primitives consume only `--vttf-*` tokens. ARIA state drives the variants.
- **Themes.** Four recipes (Codex, Parchment, Grimdark, Neon) in `examples/themes/`, each re-theming everything by overriding tokens on a parent class.
- **Brand.** `brand/` has the mark and rasters; usage rules in `brand/README.md`.

## Design principles

1. **Zero lock-in.** The output is plain `.mjs` that Foundry loads natively. Drop VTTForge whenever you like.
2. **Validated against something real.** Every API is used by a real Foundry module before it ships. Several exist only because that module broke in a way nothing reported.
3. **Fail loudly or not at all.** Where Foundry accepts something and quietly does nothing with it, VTTForge either refuses it up front or makes the mistake impossible to express.
4. **Modern tooling.** pnpm with catalogs, Turborepo, tsdown, Vite, Biome, Changesets with npm OIDC trusted publishing, publint, attw, knip, syncpack, lefthook.
5. **Community first.** MIT. No paid tiers.

## Roadmap

- ✅ **Core SDK.** Registration, data models with type inference, the sheet and application bases, migrations, the error registry
- ✅ **Build pipeline.** One Vite config, a deployable `dist/`, a release zip
- ✅ **CLI.** `init` with four templates, `dev`, `build`, `audit`
- ✅ **Dev loop.** Templates, styles and language files reload in place, without a page refresh
- ✅ **End-to-end.** Every push to `main` boots a real Foundry v13 in a container and drives the example system and module through it
- ✅ **Design system.** Tokens, primitives, themes, brand
- ✅ **Published.** Every package on npm under OIDC trusted publishing, with provenance
- ✅ **Documentation.** [vttforge.dev/docs](https://vttforge.dev/docs/) carries the guide, the API reference, the recipes and the error catalogue
- 🛠️ **Now.** Widening the Foundry surface in `@vttforge/types` as adopters hit gaps
- 🚀 **v1.0.** A stable API, decorators once the toolchain allows them, and enough adopters to know which of the remaining gaps are real

## Where it is now

Early, and I would rather say so than let you find out.

Every package is on a 0.x line, which under semver means a minor can break you, and here it regularly does. The API is still meeting real code for the first time. One module is built on it today, my own, and a good part of what the SDK does exists because that module broke in a way nothing reported.

What it needs now is not more features. It is other people's systems and modules, because the gaps that matter are the ones a second author finds and the first never did. If you build something on this and something is wrong, an issue with the case that broke is worth more to me than a pull request.

MIT, and it stays that way. No paid tier, no open core, nothing held back for a sponsor build. A tool whose whole point is that other people's work should outlive a version bump cannot have a part of itself you are not allowed to fork.

## The part that is still a promise

Foundry v14 is when this gets tested.

The argument is that when Foundry moves, the change lands in one place and your module updates a dependency instead of rewriting a sheet. That has not happened yet. There is evidence behind it, the plumbing really is in one place and the audit really does catch the quiet v13 breakages, but a design intention is not a track record. I will say plainly how it went when it happens.

There is also a version of this that fails for exactly the reason it was built. One maintainer, a quiet repository, and the dependency everyone leaned on goes still. Putting the plumbing in one place only helps if that place has more than one person who understands it. If you want to be one of them, open an issue and say so.

## Contributing

The API is being shaped against real Foundry projects, so the most useful contributions right now are:

- **Boilerplate you keep writing** in your own system or module that VTTForge could remove
- **Rough edges** in the packages as published
- **Documentation.** Always welcome

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

[MIT](LICENSE) © Fabricio Cavalcante de Souza and contributors.

---

## Disclaimer

VTTForge is an independent, community-developed project. It is not affiliated with, endorsed by, or sponsored by Foundry Gaming LLC. "Foundry Virtual Tabletop", "Foundry VTT", and "FVTT" are trademarks of Foundry Gaming LLC.
