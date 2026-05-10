# VTTForge — TODO (pre-v0.1 punch list)

Items to resolve before / during the v0.1 implementation.
Once a section is done, delete it (or move it into `CHANGELOG.md` under `[Unreleased]`).

---

## 1. DX decisions — fold into PRD **before** implementation starts

These were discussed but never made it into `PRD.md`. They shape APIs and build config, so they must be locked in before `@vttforge/core` code is written, otherwise they become v0.2 tech debt.

- [ ] **Error codes + linkable docs (`VTTF-001`, `VTTF-002`, …)**
  - Decide error-code namespace (`VTTF-` prefix vs per-package)
  - Add an `errors/` route to the future docs site (`vttforge.dev/errors/VTTF-042`)
  - Document the convention in PRD §5 (or a new §5.3 "Errors & diagnostics")
  - Add a `VttfError` class skeleton to `@vttforge/core`'s scope
- [ ] **Source maps in published packages**
  - Configure `tsdown` with `sourcemap: true` (or `"inline"`) per package
  - Add `**/*.map` to each `package.json` `files` field
  - Note in PRD §5 that consumer DevTools step into `.mts` source, not minified output
- [ ] **`vttforge migrate` codemod — decide v0.2 vs v1.0**
  - If v0.2: add to roadmap §9, commit to a codemod runner choice (`jscodeshift` vs `ts-morph` vs `ast-grep`)
  - If v1.0: leave out of v0.x scope explicitly so it doesn't get half-built
- [ ] **Schema-to-TS inference — keep in v1.0 or pull forward to v0.1?**
  - Currently in v1.0. The PRD calls it the #1 stated pain ("double work").
  - Decision needed: ship `InferSchema<typeof defineSchema>` helper in v0.1 (small surface, big DX win) or hold for v1.0 stable API
  - If v0.1: add to §7 API design and v0.1 roadmap

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

- [ ] **Docs site tooling for `vttforge.dev`** — VitePress vs Starlight (Astro) vs Nextra. Decide when v0.3 starts. Recommendation pending: VitePress for tight Vite alignment.
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
