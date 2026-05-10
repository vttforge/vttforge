# Changelog

All notable changes to VTTForge will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Changed (PRD v1.2 — tooling + CSS finalization)

- **Library bundler:** `tsdown` (Rolldown-based) replaces Vite library mode for the SDK packages. Vite remains the dev server consumed by `vttforge dev`.
- **Package manager:** pnpm + Corepack replaces Bun workspaces for monorepo + publishing.
- **CSS strategy** finalized:
  - New `@vttforge/styles` package will ship the base CSS layer (tokens, reset, base, components, opt-in themes).
  - Scoping uses CSS Cascade Layers (`@layer foundry, vttforge.tokens, vttforge.base, vttforge.components, system;`).
  - `@vttforge/vite-plugin` will ship a vanilla CSS + PostCSS pipeline (Sass opt-in via consumer install; Tailwind not bundled — documented recipe only).

### Removed

- `FVTT-SDK-PRD.md` — obsolete pre-rename draft. `PRD.md` v1.2 is now the single source of truth.

### Planned for v0.1.0

- Turborepo monorepo skeleton with **pnpm workspaces** + Corepack
- `tsdown` configured per package (`.mjs` + `.d.mts` output)
- Biome lint + format config
- Changesets for versioning + `changeset-bot` (GH App)
- `lefthook` git hooks (pre-commit Biome, pre-push typecheck)
- `syncpack` for cross-package dep version alignment
- TypeScript strict + ESM-only base config
- GitHub Actions CI: `lint`, `typecheck`, `test`, `build`, `package-quality` (`publint` + `@arethetypeswrong/cli`), `knip`
- GitHub Actions release: `changesets/action@v1` with npm provenance via OIDC
- `@vttforge/core`:
  - `f` fields alias re-export
  - `BaseTypeDataModel` (eliminates stub `migrateData`)
  - `SystemConfig` (eliminates hardcoded system ID strings)
  - `BaseActorSheet` / `BaseItemSheet` (eliminates DragDrop, `_getTabs`, `_onEditImage`, `_onDrop` boilerplate)
  - `createMigrationRunner`
  - `registerSystem` (one-call init replacing `Hooks.once("init")` block)
- `@vttforge/styles`:
  - `tokens.css`, `reset.css`, `base.css`, `components.css`, `index.css`
  - Cascade layers wiring + opt-in themes (`light`, `dark`, `high-contrast`, `auto`)
- `examples/simple-system` working demo (consumes `@vttforge/core` + `@vttforge/styles`)
- Migration of [`ordemparanormal_fvtt`](https://github.com/fcsouza/ordemparanormal_fvtt) to validate the API

---

## [0.0.0] — 2026-05-04

Initial placeholder release. Names reserved on the npm registry. No functionality yet.

### Added

- Project name finalized: **VTTForge**
- GitHub organization created: [`github.com/vttforge`](https://github.com/vttforge)
- npm scope created: [`npmjs.com/~vttforge`](https://www.npmjs.com/~vttforge)
- Placeholder packages published to reserve names:
  - [`@vttforge/core@0.0.0`](https://www.npmjs.com/package/@vttforge/core)
  - [`@vttforge/cli@0.0.0`](https://www.npmjs.com/package/@vttforge/cli)
  - [`@vttforge/vite-plugin@0.0.0`](https://www.npmjs.com/package/@vttforge/vite-plugin)
  - [`@vttforge/testing@0.0.0`](https://www.npmjs.com/package/@vttforge/testing)
  - [`@vttforge/types@0.0.0`](https://www.npmjs.com/package/@vttforge/types)
- Trademark disclaimer drafted (Foundry Gaming LLC compliance)
- [PRD.md](./PRD.md) v1.1 documenting goals, architecture, and roadmap

[Unreleased]: https://github.com/vttforge/vttforge/compare/v0.0.0...HEAD
[0.0.0]: https://github.com/vttforge/vttforge/releases/tag/v0.0.0
