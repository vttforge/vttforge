# VTTForge — Long Horizon

Items parked for later. Two kinds live here:

- **Tactical deferrals** — decisions intentionally pushed to a specific later milestone (e.g. enable at v0.1 release, not now)
- **Strategic ideas** — valuable but only make sense once the SDK is stable (e.g. post-v1.0 codemod tooling)

Each item lists its **revisit point** so it doesn't get forgotten.

Promote an item out of here by moving it into `TODO.md` (with a target version) or into `PRD.md` (if it's becoming a concrete deliverable).

---

## `.github/FUNDING.yml` — GitHub Sponsors / Patreon

**Revisit point:** at the v0.1.0 release PR.

**What it is.** A `.github/FUNDING.yml` file (2 lines) that surfaces a "Sponsor" button on the repository, pointing to GitHub Sponsors and/or other platforms.

**Why deferred.** Pre-v0.1 means there's no usable artefact yet. Adding a Sponsor button before shipping anything signals "pay before I deliver" — wrong signal for an early-stage open-source project that builds trust via execution, not capture. Cost of deferring is zero (the file is trivial to add later); cost of doing it now is a small but real reputational tax.

**Why not post-v1.0 either.** The window matters: at v0.1 release there's launch enthusiasm — users who try the SDK and find it valuable are the most likely to support it. Waiting until v1.0 misses that window.

**When promoted (at v0.1 PR):**

- Confirm GitHub Sponsors enabled on the `fcsouza` account (or a dedicated `vttforge` org account if created)
- Decide whether to list Patreon, Ko-fi, Open Collective, etc. in addition — keep it minimal (GitHub Sponsors only is fine)
- Phrasing in README/docs: explicitly "no required tiers, no paid features" to keep the community-first posture aligned with PRD §11 open question #4 lean
- File shape:
  ```yaml
  github: fcsouza
  ```

Tracked back to PRD §11 still-open #4 (sponsorship decision). Promotion to `TODO.md` collapses that open question.

---

## `vttforge migrate` — codemod for adopting VTTForge from a vanilla FoundryVTT system

**Revisit point:** after v1.0 ships, once at least 2-3 community systems have manually adopted VTTForge.

**What it is.** A CLI command (`vttforge migrate`) that runs codemod scripts over an existing FoundryVTT system source tree and rewrites the boilerplate patterns audited in PRD §3 into VTTForge equivalents:

- Sheets extending `ActorSheet`/`ItemSheet` → extend `BaseActorSheet`/`BaseItemSheet`
- Inline `#createDragDropHandlers()` blocks → removed (provided by base class)
- `_getTabs()` switch tables → `static TABS = { ... }`
- `game.settings.get("system-id", "key")` → `sys.get("key")` via a `SystemConfig`
- Stub `migrateData(data) { return super.migrateData(data) }` → removed
- `const fields = foundry.data.fields` aliases → `import { f } from "@vttforge/core"`

**Why valuable.** The biggest adoption lever — turns "I'd love to migrate but it's 50 files" into one command. Also a DX validator: if the codemod is hard to write, the API is probably wrong.

**Why parked.** Not necessary to ship the SDK or migrate the first consumer (`ordemparanormal` can be ported manually as the v0.1 reference migration). High maintenance cost — codemods rot quickly as the API evolves, so it makes more sense after v1.0 stabilizes the public API and `breaking changes are rare.

**When to revisit.** After v1.0 ships and at least 2-3 community systems have manually adopted VTTForge — those manual migration diffs become the input data for designing the codemod transformations.

**Open sub-questions when promoted:**

- Codemod runner: `jscodeshift` (Meta, AST visitor pattern, used by React/Next.js/MUI) vs `ts-morph` (typed project graph, easier when transformations need to read TS types) vs `ast-grep` (YAML-pattern matching, ergonomic for simple substitutions). Lean: `ts-morph` because most transforms need to know whether a class extends `ActorSheet` vs `ItemSheet`, which requires type info.
- Distribution: bundle into `@vttforge/cli` as a subcommand, or separate `@vttforge/codemods` package?
- Scope: also rewrite `system.json` manifest, or only `.mts`/`.mjs` source?
