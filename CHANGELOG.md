# Changelog

All notable changes to VTTForge will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added 2026-05-10 — Repo housekeeping

Section 2 of `TODO.md` resolved (all but `FUNDING.yml`):

- `LICENSE` (MIT)
- `.gitignore` (Node/TS/pnpm/Turborepo)
- `CONTRIBUTING.md` (pre-v0.1 stance + forward-looking dev workflow)
- `SECURITY.md` (GitHub private vulnerability reporting + npm provenance verification)
- `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1)
- `.github/ISSUE_TEMPLATE/bug_report.yml`
- `.github/ISSUE_TEMPLATE/feature_request.yml`
- `.github/ISSUE_TEMPLATE/config.yml` (disables blank issues, routes security/discussions correctly)
- `.github/PULL_REQUEST_TEMPLATE.md`

`FUNDING.yml` deferred until PRD §11 open question #4 (sponsorship) is decided.

### Decided 2026-05-10 — DX patterns (PRD v1.4)

Three DX patterns locked in after web-source verification (Zod, Valibot, Effect, Drizzle, Astro errors-data, React/Vue numeric codes, Biome diagnostics, tsdown sourcemap):

- **Errors:** hybrid `VTTF-NNNN` (numeric URL key, append-only, stable across majors) + PascalCase `name` field in central registry. `VttfError extends Error` with `code`, `name`, `docsUrl`, native `cause` (ES2022); multi-cause = `AggregateError`. Codegen emits runtime constants + JSON manifest + VitePress `/errors/VTTF-NNN` pages. PRD §7.
- **Source maps:** external `.map` files with `sourcesContent` embedded via `tsdown` `sourcemap: true` + `declarationMap: true`. NOT inline, NOT hidden. PRD §5.3.
- **Schema-to-TS inference:** phased — partial `InferSchema<T>` in v0.1 covering primitive fields + nested `SchemaField` + `ArrayField` (~80% coverage); full class-level inference + Drizzle-style `$inferData` accessor in v1.0, moved to `@vttforge/types` versioned with Foundry. Use `Prettify<T>` for IDE perf. PRD §7.

### Decided 2026-05-10 — Docs site tooling

- **VitePress 1.x stable** chosen for `vttforge.dev` (planned v0.3) over Starlight, Docusaurus, Nextra, Rspress, Fumadocs, and Mintlify. Rationale: native Vite alignment with our existing monorepo, no parallel React/Next.js/Rspack toolchain required.
- **Companion plugins:** `@viteplus/versions` (versioned docs), `typedoc-plugin-markdown` + `typedoc-vitepress-theme` (auto API reference from tsdown entrypoints), `@shikijs/vitepress-twoslash` (TS hover types in code blocks, opt-in per block), Pagefind (offline zero-config search).
- **Restored v0.3 roadmap section** (CLI scaffolding + docs site) which was inadvertently dropped during the v1.2 PRD edits.

### Changed (PRD v1.3 — verification corrections, May 2026)

- **CSS cascade layer naming corrected.** Foundry v13 already owns top-level layer names (`reset, variables, elements, blocks, applications, compatibility, layouts, system, modules, exceptions`) and auto-wraps consumer manifest CSS in the `system` layer. VTTForge's published CSS uses *only* a vendored sub-layer prefix: `@layer vttforge.reset, vttforge.tokens, vttforge.base, vttforge.components`. The previous draft's top-level `foundry` and `system` names would have been ignored or misordered by Foundry's runtime.
- **Handlebars HMR plugin reference replaced.** The previously cited `nicktindall/vite-plugin-handlebars` does not exist (the GitHub user has no such repo). Replaced with `alexlafroscia/vite-plugin-handlebars` v2.0.3 (Apr 2026, claims Vite 5–8 support) plus a small custom plugin in `@vttforge/vite-plugin` for sheet-template re-render to compensate for known partial-HMR issues.
- **`foundry-vtt-types` was renamed to `fvtt-types`.** Install via `fvtt-types@github:League-of-Foundry-Developers/foundry-vtt-types#<sha>` and pin a git SHA from `main` (last npm release v13.341.1 is 10 months stale).
- **CI pipeline modernized:**
  - `pnpm/action-setup@v4` → `@v6` (v4 is two majors behind).
  - npm Trusted Publishing (OIDC) is GA since 2025-07-31 — drop `NPM_TOKEN` and the `--provenance` flag (auto-generated under OIDC). Configure trusted publisher per package on npmjs.com.
  - Split into two workflows (`changesets.yml` opens the Version PR; `publish.yml` runs OIDC publish with `id-token: write`) per `changesets/action#515`.
  - npm CLI ≥ 11.5.1, Node ≥ 22.14.0 required.
- **Tailwind recipe split:** v3 is the primary recipe (`docs/recipes/tailwind-v3.md`); v4 is experimental (`docs/recipes/tailwind-v4.md`) until `electron-vite#741` and Chromium hover/render bugs resolve.
- **Foundry Theme V2 integration:** `@vttforge/styles` `--vttf-*` tokens consume Foundry's `CONST.CSS_THEMES` variables (e.g. `--color-text-primary`, `--background`) instead of redefining them.
- **pnpm catalogs adopted from v0.1** for cross-workspace dependency pinning. `syncpack` v15+ auto-migrates and validates.
- **Mantine-style `styles.layer.css`** variant added to `@vttforge/styles` for consumers who want explicit `@layer vttforge` wrapping.
- **`tsdown` DTS+peer-deps caveat** documented (`rolldown-plugin-dts#199` open since Mar 2026); mitigated via explicit `external` config and `dts.resolve` options.
- **Optional Oxlint** added as a CI fast-fail layer — v1.0 stable since Aug 2025; not a Biome replacement.
- **Trusted publishing elevated to v0.1 requirement** (was v1.0 nice-to-have) post the late-2025 supply-chain incidents (Shai-Hulud variants, Bitwarden CLI hijack).

### Changed (PRD v1.2 — tooling + CSS finalization)

- **Library bundler:** `tsdown` (Rolldown-based) replaces Vite library mode for the SDK packages. Vite remains the dev server consumed by `vttforge dev`.
- **Package manager:** pnpm + Corepack replaces Bun workspaces for monorepo + publishing.
- **CSS strategy** finalized:
  - New `@vttforge/styles` package will ship the base CSS layer (tokens, reset, base, components, opt-in themes).
  - Scoping uses CSS Cascade Layers.
  - `@vttforge/vite-plugin` will ship a vanilla CSS + PostCSS pipeline (Sass opt-in via consumer install; Tailwind not bundled — documented recipe only).

### Removed

- `FVTT-SDK-PRD.md` — obsolete pre-rename draft. `PRD.md` v1.2 is now the single source of truth.

### Planned for v0.1.0

- Turborepo monorepo skeleton with **pnpm 10+ workspaces** + Corepack via `"packageManager"` field
- `pnpm-workspace.yaml` with `catalog:` section pinning shared deps
- `tsdown` configured per package (`.mjs` + `.d.mts` output) with explicit `external` and `dts.resolve` config
- Biome lint + format config (Oxlint as optional CI fast-fail pre-check)
- Changesets for versioning + `changeset-bot` (GH App)
- `lefthook` git hooks (pre-commit Biome, pre-push typecheck)
- `syncpack` v15+ for cross-package dep version alignment + pnpm catalog migration
- TypeScript strict + ESM-only base config
- `fvtt-types` pinned to a `main` git SHA (not an npm tag)
- GitHub Actions CI: `lint`, `typecheck`, `test` (Node 22 + 24), `build`, `package-quality` (`publint` + `@arethetypeswrong/cli`), `knip`
- GitHub Actions release: split `changesets.yml` (Version PR) + `publish.yml` (OIDC trusted publish with `id-token: write`, no `NPM_TOKEN`, no `--provenance` flag)
- `pnpm/action-setup@v6` (reads version from `packageManager`)
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
