# create-vttforge

## 0.3.0

### Minor Changes

- 9462144: Require Node 26.

  The floor moves from `>=22.14.0` to `>=26.0.0` across every package and the
  four scaffolding templates, and the bundler target for the Node-side
  packages moves from `node22` to `node26`.

  Node 22 entered maintenance in October 2025 and receives security fixes
  only. Node 26 becomes the active LTS line on 2026-10-28.

  This is breaking for anyone on Node 22 or 24. It is marked `minor` rather
  than `major` on purpose: these packages are still on 0.x, where a minor
  signals the break, and a major would push every package to 1.0.0 — a claim
  of API stability that has not been audited, on packages two of which are
  still stubs.

  The templates move to the versions this release publishes. On 0.x a caret
  pins the minor, so their old ranges would not have matched.

  CI now pins Node through `actions/setup-node` instead of inheriting whatever
  the runner image ships, so the version the packages declare is the version
  they are tested on. It was not before: the workflow took the image's Node,
  and nothing enforced the declared floor because `engine-strict` is not set.

### Patch Changes

- Updated dependencies [9462144]
  - @vttforge/cli@0.2.0

## 0.2.1

### Patch Changes

- Updated dependencies [5f03da9]
  - @vttforge/cli@0.1.1

## 0.2.0

### Minor Changes

- eb1c41d: feat(cli): ship the `vttforge init` scaffolder + four built-in templates

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

### Patch Changes

- Updated dependencies [6e36de2]
- Updated dependencies [edd88fe]
- Updated dependencies [139802c]
- Updated dependencies [09de435]
- Updated dependencies [eb1c41d]
- Updated dependencies [4ba725c]
- Updated dependencies [4d34985]
  - @vttforge/cli@0.1.0
