---
'@vttforge/cli': minor
'create-vttforge': minor
---

feat(cli): ship the `vttforge init` scaffolder + four built-in templates

`@vttforge/cli` now provides a real, interactive scaffolder. `vttforge init`
(or `pnpm create vttforge` via the new `create-vttforge` package) walks the
user through naming the project, picking system/module + TypeScript/JavaScript,
and writing a complete VTTForge starter into a new directory.

**Bin commands:**

- `vttforge init [name]` — interactive scaffolder. Honors `--type`, `--lang`,
  `--no-install`, `--no-git` flags; everything else is prompted for via
  `@clack/prompts`. Detects the calling package manager via
  `npm_config_user_agent` (pnpm / npm / bun / yarn) and offers to run
  `<pm> install` after writing files. Optionally initializes a git repo
  with an initial commit.
- `vttforge dev`, `vttforge build`, `vttforge audit` — reserved subcommands
  that print a discoverable next-step message until their real
  implementations land in a later release.

**Four built-in templates** under `packages/cli/templates/`:

- `system-ts` / `system-js` — realistic Foundry v13+ system that mirrors
  the reference `examples/simple-system`. Ships `CharacterData` + `GearData`
  TypeDataModels, `CharacterSheet` + `GearSheet` extending `BaseActorSheet`
  / `BaseItemSheet`, a `createMigrationRunner` with one example migration,
  Handlebars templates for both sheets, the four v13 manifest shapes
  (`grid`, `styles: [{src}]`, `flags.hotReload` at the root of `flags`,
  per-subtype `htmlFields`), and a tagged-release GitHub Actions workflow
  that builds + zips + publishes to a GitHub Release.
- `module-ts` / `module-js` — minimal but realistic module. Registers a
  client-scope setting via `SystemConfig` from `@vttforge/core`, listens on
  `renderActorSheetV2` to tag the rendered sheet with a discreet badge,
  exposes a tiny API on `game.modules.get(id).api`, and ships the same
  tag-driven release workflow.

**New package — `create-vttforge`** — thin wrapper around `@vttforge/cli init`
that enables the `pnpm create vttforge my-system` / `npm create vttforge@latest my-system`
UX familiar from the `create-vite` / `create-next-app` ecosystem.

44 unit tests cover the substitution logic, the package-manager detector, and
a per-template integration suite that scaffolds every variant into a temporary
directory and asserts shape (no leftover placeholders, valid manifest,
expected files). Templates are excluded from biome and vitest scanning since
they contain `{{PLACEHOLDER}}` strings that aren't valid TypeScript/JSON until
substitution.
