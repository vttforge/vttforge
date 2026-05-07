# Changelog

All notable changes to VTTForge will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Planned for v0.1.0

- Turborepo monorepo skeleton with Bun workspaces
- Biome lint + format config
- Changesets for versioning
- TypeScript strict + ESM-only base config
- GitHub Actions CI (lint, test, build)
- `@vttforge/core`:
  - `f` fields alias re-export
  - `BaseTypeDataModel` (eliminates stub `migrateData`)
  - `SystemConfig` (eliminates hardcoded system ID strings)
  - `BaseActorSheet` / `BaseItemSheet` (eliminates DragDrop, `_getTabs`, `_onEditImage`, `_onDrop` boilerplate)
  - `createMigrationRunner`
  - `registerSystem` (one-call init replacing `Hooks.once("init")` block)
- `examples/simple-system` working demo
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
