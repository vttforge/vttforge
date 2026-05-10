# VTTForge — Long Horizon

Ideas parked for **after v1.0** (or beyond). Not actionable now.
Things move here when they're valuable but not aligned with current priorities,
or when the cost-to-benefit only makes sense once the SDK is stable.

Promote an item out of here by moving it into `TODO.md` (with a target version)
or into `PRD.md` (if it's becoming a concrete deliverable).

---

## `vttforge migrate` — codemod for adopting VTTForge from a vanilla FoundryVTT system

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
