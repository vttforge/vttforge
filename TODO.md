# VTTForge — TODO (pre-v0.1 punch list)

Items to resolve before / during the v0.1 implementation.
Once a section is done, delete it (or move it into `CHANGELOG.md` under `[Unreleased]`).

---

## 1. DX decisions — fold into PRD **before** implementation starts ✅ RESOLVED 2026-05-10

All three locked in via PRD v1.4. Research backing each decision documented in agent transcript (errors registry: Astro / React / Vue patterns; source maps: Vite/tsdown defaults + Vitest cautionary tale; schema inference: Zod / Valibot / Effect / Drizzle).

- [x] **Error codes + linkable docs (`VTTF-NNNN`)** — Hybrid: numeric URL key (`VTTF-042`, append-only, stable across majors) + PascalCase `name` field in registry for stack-trace clarity. Single global namespace. Central registry at `packages/core/src/errors/registry.ts`; codegen pre-build hook emits runtime constants + JSON manifest + VitePress `/errors/VTTF-NNN` pages. `VttfError extends Error` with `code`, `name`, `docsUrl`, native `cause` (ES2022). Multi-cause = `AggregateError`. PRD §7 (Errors & diagnostics).
- [x] **Source maps in published packages** — External `.map` files with `sourcesContent` embedded via `tsdown` `sourcemap: true` + `declarationMap: true`. NOT inline (consumer bundle bloat), NOT hidden (DevTools won't load). PRD §5.3.
- [x] **Schema-to-TS inference — phased v0.1 / v1.0** — Partial `InferSchema<T>` in v0.1 covering primitive field subset (`NumberField`, `StringField`, `BooleanField`, `HTMLField`, `ArrayField`, `SchemaField`, `ColorField`, `FilePathField`) — ~80% coverage. Full class-level inference (`extends BaseTypeDataModel<typeof Schema>`) + Drizzle-style `$inferData` accessor + remaining fields (`EmbeddedDataField`, `EmbeddedDocumentField`, `TypedSchemaField`) deferred to v1.0, moved to `@vttforge/types` versioned with Foundry support range. Use `Prettify<T>` on all public conditional types for IDE perf. PRD §7 (InferSchema<T>).

## 2. Repo housekeeping — before first external eyes

Can land in parallel with the v0.1 monorepo skeleton PR; not a blocker for starting code.

- [ ] **`LICENSE`** — README claims MIT, file doesn't exist yet. Add SPDX header text from https://spdx.org/licenses/MIT.html with `Copyright (c) 2026 Fabricio Cavalcante de Souza and contributors`.
- [ ] **`.gitignore`** — currently empty. At minimum: `node_modules/`, `dist/`, `.turbo/`, `*.tsbuildinfo`, `coverage/`, `.DS_Store`, `.env*`, `*.log`.
- [ ] **`CONTRIBUTING.md`** — README promises "when it lands". Cover: how to set up the monorepo (Corepack + pnpm), how to run tests, the changeset workflow, the conventional-commit style, the security disclosure pointer.
- [ ] **`SECURITY.md`** — relevant given the supply-chain / OIDC posture. Use the GitHub-recommended template; point to `security@vttforge.dev` (or fcsouza's email until the domain is up).
- [ ] **`.github/ISSUE_TEMPLATE/`** — at minimum `bug_report.yml` and `feature_request.yml` (form-based, not legacy markdown).
- [ ] **`.github/PULL_REQUEST_TEMPLATE.md`** — checklist for: changeset present, tests added/updated, docs touched if API changed.
- [ ] **`.github/FUNDING.yml`** — only if open-question #4 (sponsorship) is decided yes for v0.1.
- [ ] **`CODE_OF_CONDUCT.md`** — Contributor Covenant 2.1 boilerplate is fine.

## 3. Open technical decisions — decide just-in-time, not blocking

Don't pre-decide these; resolve when the relevant PR comes up.

- [x] **Docs site tooling for `vttforge.dev`** — **Decided 2026-05-10: VitePress 1.x stable** (not 2.x alpha) + `@viteplus/versions` (versioning) + `typedoc-plugin-markdown` + `typedoc-vitepress-theme` (API reference from tsdown entrypoints) + `@shikijs/vitepress-twoslash` (TS hover types in code blocks, opt-in per block due to perf cost) + Pagefind (zero-config offline search). Rationale: native Vite alignment with our stack, no parallel React/Next.js/Rspack toolchain. Folded into PRD §9 v0.3 roadmap.
- [ ] **Foundry Theme V2 token contract** — exact list of `CONST.CSS_THEMES` variables to consume. Inspect Foundry v13.341+ source before finalizing `@vttforge/styles/tokens.css`.
- [ ] **Semver / deprecation policy** — explicit policy doc (deprecation window, breaking-change cadence). Defer until just before v1.0 RC.
- [ ] **`@scope` adoption** — track Foundry compatibility through v0.2 sheet examples; decide for v1.0.
- [ ] **`happy-dom` vs `jsdom` default** — start with `happy-dom`; revisit at v0.2 if Foundry-specific gaps surface.
- [ ] **Citty escape hatch** — re-evaluate at v1.0 against Commander v13.

## 4. Off-repo setup — at publish time only

Only matters when actually shipping the first npm release. No action before that.

- [ ] Configure Trusted Publisher on npmjs.com for each `@vttforge/*` package
  - `@vttforge/core`, `@vttforge/styles`, `@vttforge/cli`, `@vttforge/vite-plugin`, `@vttforge/testing`, `@vttforge/types`
  - Each points to: repo `vttforge/vttforge`, workflow file `.github/workflows/publish.yml`, environment (none required)
- [ ] Validate scoped-package E404 is not hit (`npm/cli#8976`) — test with a throwaway scope first if uncertain
- [ ] Branch protection on `main`: required reviews (1), required checks (`lint`, `typecheck`, `test`, `build`, `package-quality`), linear history, no force pushes
- [ ] Install `changeset-bot` GitHub App on the `vttforge` org
- [ ] Enable Turbo Remote Cache (Vercel-hosted free tier or self-hosted)
- [ ] Decide on GitHub Sponsors activation (linked to open question #4)
- [ ] Register `vttforge.dev` domain (planned for v0.3)
