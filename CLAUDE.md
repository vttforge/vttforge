# CLAUDE.md — VTTForge

## Project Overview

VTTForge is a modern SDK and CLI for building FoundryVTT v13+ systems and modules. Monorepo. Pre-v0.1 (no functional packages yet — names reserved on npm).

The first reference consumer is a real production FoundryVTT system. Every API decision is validated against that codebase before being generalized.

## Status

Foundation work in progress. See `.internal/PRD.md` for the full spec, `.internal/TODO.md` for the punch list, and `.internal/to-revise.md` for GitHub repo config items deferred until v0.1.

## Foundry VTT Conventions

- **Use the `Foundry system guidance` skill** for Foundry API reference (TypeDataModel, `defineSchema`, `foundry.data.fields`, dice, combat, migration, manifest, `documentTypes`, character sheets).
- **Use the `Foundry module guidance` skill** for ApplicationV2, hooks lifecycle, settings, sockets, ActiveEffects, journal page types, custom enrichers.
- Before writing any code that touches Foundry APIs, invoke the relevant skill above. Do not derive API shapes from memory.
- ES modules only (`import`/`export`), no CJS.
- Target Foundry v13+ — v12 is an explicit non-goal.
- Register data models on `CONFIG.Actor.dataModels` / `CONFIG.Item.dataModels` in the `init` hook.
- Use `foundry.data.fields` for schema definitions.
- Never write to DB inside `prepareDerivedData()` — purely in-memory derivations.
- Always `await roll.evaluate()` (sync `.roll()` is deprecated in v13).
- CSS uses `@layer` for v13 cascade-layer compatibility. Vendored layer prefix `vttforge.*` (not top-level `system` — Foundry owns that namespace, see `.internal/PRD.md §5.2`).

## Stack (locked in PRD v1.4)

- **Package manager:** pnpm 10+ via Corepack. `"packageManager": "pnpm@10.x"` in root `package.json`.
- **Monorepo:** Turborepo.
- **Bundler (SDK packages):** `tsdown` (Rolldown-based). Output `.mjs` + `.d.mts`.
- **Language:** TypeScript 5.x strict, ESM-only.
- **Linter/formatter:** Biome. Optional Oxlint as a CI fast-fail layer.
- **Test runner:** Vitest with `happy-dom`.
- **Git hooks:** `lefthook`.
- **Versioning:** Changesets.
- **Dep sync:** `syncpack` v15+ with pnpm catalog support.
- **CI:** GitHub Actions. Matrix Node 22 + 24.
- **Publishing:** npm OIDC Trusted Publishing (no `NPM_TOKEN`, no `--provenance` flag).
- **Foundry types:** `fvtt-types` pinned to a git SHA from `main` (not npm).

## Commands

```bash
corepack enable
pnpm install
pnpm typecheck     # turbo → tsc --noEmit per package
pnpm test          # turbo → Vitest per package
pnpm build         # turbo → tsdown per package
pnpm lint          # biome ci . + syncpack lint
pnpm format        # biome check --write .
pnpm publint       # turbo → publint per package
pnpm attw          # turbo → @arethetypeswrong/cli per package
```

### Known quirk: pnpm + biome OOM warning

`pnpm lint` may print `[warn] Linter process terminated abnormally (possibly out of memory)` when the parent shell has certain TTY/stdio setups (observed on macOS arm64 + Node 26 + pnpm 10.33). Workaround: run via a fresh subshell (`bash -c "pnpm lint"`) or call biome directly (`./node_modules/.bin/biome ci . --colors=off`). CI is unaffected (it always runs in a fresh subshell).

## Repo Structure

- `packages/` — `@vttforge/*` SDK packages (core, styles, vite-plugin, cli, testing, types).
- `examples/` — reference consumers (simple-system, simple-module).
- `.internal/` — internal planning docs (gitignored). PRD, TODO, LONG-HORIZON, to-revise.
- `.agents/skills/` + `.claude/skills/` — pulled via `skills-lock.json`, gitignored.
- `.github/` — workflows, issue/PR templates, dependabot config.

## Conventions

- Conventional Commits (`feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `build`, `ci`). Scopes: package names (`core`, `cli`, `vite-plugin`, `styles`, `testing`, `types`) or `docs`/`prd`/`ci`/`deps`/`release`.
- One scope per PR. The first PR (`#1`) accidentally bundled unrelated commits — don't repeat.
- Changesets required for any user-visible change in any `@vttforge/*` package.
- Error codes follow the `VTTF-NNNN` registry pattern (see `.internal/PRD.md §7`). Append-only, stable across majors.
- Source maps: external `.map` files with `sourcesContent` embedded. Never inline, never hidden.
