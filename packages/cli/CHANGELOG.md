# @vttforge/cli

## 0.1.0

### Minor Changes

- e12ea5d: feat(cli): ship `vttforge audit` — scan for seven v13 footguns

  Closes the third and final slice of Track 1. `vttforge audit [path]` scans
  a system or module project root and reports findings against the
  `VTTF-AUDIT-NNN` catalog of v13 manifest + code footguns.

  **Rules implemented:**

  | ID               | Severity | Scope             | What it catches                                                                                                                                                                                                                                                                                                                                         |
  | ---------------- | -------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `VTTF-AUDIT-001` | HIGH     | manifest          | `flags.hotReload` as array (v12) or missing required `extensions` key. Silently disables HMR.                                                                                                                                                                                                                                                           |
  | `VTTF-AUDIT-002` | MEDIUM   | manifest          | Top-level `gridDistance` / `gridUnits` (v12) instead of `grid: {type, distance, units, diagonals}` (v13). Auto-migrates today, removed in v14.                                                                                                                                                                                                          |
  | `VTTF-AUDIT-003` | LOW      | manifest          | `styles: ["foo.css"]` (string array) instead of `[{src, layer?}]` (v13). Auto-migrates but loses cascade-layer control.                                                                                                                                                                                                                                 |
  | `VTTF-AUDIT-004` | MEDIUM   | manifest + source | `HTMLField` / `FilePathField` declared in TypeDataModel schema but missing from `documentTypes.<Doc>.<subtype>.htmlFields` / `.filePathFields`. Server only sanitises declared paths → XSS risk on undeclared. Subtype-aware via `CONFIG.*.dataModels` + `registerSystem({ actorDataModels })` parsing; full-path matching through SchemaField nesting. |
  | `VTTF-AUDIT-005` | MEDIUM   | source            | `class X extends TypeDataModel` without a `prepareBaseData()` method. Active Effects apply between base and derived; consumers see uninitialised fields. Checked per class.                                                                                                                                                                             |
  | `VTTF-AUDIT-006` | LOW      | source            | `_addDataFieldMigrations()` override on a TypeDataModel subclass. Real API is `static migrateData(source)` calling singular `super._addDataFieldMigration(...)`.                                                                                                                                                                                        |
  | `VTTF-AUDIT-007` | MEDIUM   | manifest + source | `primaryTokenAttribute` / `secondaryTokenAttribute` doesn't resolve to a `SchemaField({ value, max })` at the exact dot-path. Nested paths like `attributes.hp` are traversed.                                                                                                                                                                          |

  **CLI surface:**

  ```bash
  vttforge audit                  # scan cwd, print markdown
  vttforge audit ./my-project     # scan a different path
  vttforge audit --json           # machine-readable JSON for CI piping
  vttforge audit --strict         # exit 1 on any finding (default: HIGH only)
  ```

  **Exit codes:**
  - `0` — clean, or only MEDIUM/LOW findings (advisory mode)
  - `1` — at least one HIGH finding, or any finding in `--strict`

  Uses `process.exitCode` (not `process.exit`) so piped JSON reports aren't
  truncated on failing CI runs.

  **Implementation notes:**
  - Pure read-only — never modifies the source tree.
  - Regex-based source scanning. The trade-off is occasional false negatives
    on heavily-formatted code; an AST dependency (TypeScript compiler) would
    add ~30MB to the CLI for seven pattern checks. Rule 007's
    `SchemaField({value, max})` detection uses a balanced-brace scan plus a
    depth-tracking top-level-key extractor to correctly distinguish
    SchemaField siblings from nested constructor options.
  - Rule 005 distinguishes `extends TypeDataModel` (direct, flagged) from
    `extends BaseTypeDataModel()` (VTTForge factory, safe) via the `\b`
    word boundary, and is checked per class so a sibling subclass without
    the hook doesn't hide behind a sibling that has it.
  - Rule 004 takes the FULL schema path through enclosing SchemaField
    wrappers and matches exactly against declared paths (with `system.`
    prefix stripped — Foundry convention).

  **Tests:** 247 passing (+13 new test files, ~110 new test cases). Integration
  suite scaffolds each of the four templates and runs the audit against the
  output — they must report zero findings, otherwise either a template
  regressed or the audit grew a false positive.

- 78107bb: feat(cli): ship `vttforge dev` and `vttforge build`

  `@vttforge/cli` graduates from "scaffold-only" to a full local dev loop.

  **`vttforge dev`** — single-process dev experience for system/module work:
  1. Runs `vite build` once to populate `dist/` and emit the manifest.
  2. Reads the manifest, detects whether the project is a system or module.
  3. Resolves the Foundry user-data directory via a four-step chain:
     `--data-dir` flag → `FOUNDRY_DATA_DIR` env → project's
     `.vttforge/config.json` → OS default with interactive first-run
     prompt that saves the choice. OS detection honors `XDG_DATA_HOME`
     on Linux and `%LOCALAPPDATA%` on Windows.
  4. Drops a symlink at `<dataRoot>/Data/<systems|modules>/<id>` pointing
     at the project's `dist/`. Cross-platform — `junction` on Windows so
     the call succeeds without Developer Mode or admin elevation; safety
     rails refuse to overwrite real files/directories.
  5. Spawns `vite build --watch` with inherited stdio, blocks until
     SIGINT/SIGTERM, then cleans up the symlink and kills vite.

  When Foundry runs with `--hotReload`, file saves trigger live reload
  without a browser refresh — chokidar follows the symlink and Foundry's
  built-in dispatcher swaps CSS/HBS/JSON in place. No additional client
  wiring needed in this release.

  **`vttforge build`** — produces a foundryvtt.com-ready release zip:
  1. Cleans `dist/`, runs `vite build` in production mode.
  2. Reads the manifest for `id` + `version`.
  3. Emits `<id>-<version>.zip` at the project root with contents at the
     zip root (no wrapper folder), pulling in `LICENSE`, `README.md`, and
     `CHANGELOG.md` from the project root when present and not already
     inside `dist/`.

  **Templates updated** — all four (system-ts, system-js, module-ts,
  module-js) now ship `pnpm dev` / `pnpm build` aliased to the new
  commands, drop the manual `ln -s` instructions, and gain
  `@vttforge/cli` as a devDependency. The release workflow continues to
  invoke vite directly so URL injection happens after build but before
  zipping; it now validates tag-derived version strings and passes every
  GitHub-supplied value via `env:` instead of inline interpolation to
  close a command-injection vector that a malicious tag push could
  otherwise exploit.

  **Internals exposed** — `runDev`, `runBuild`, `emitReleaseZip`,
  `setupDevSymlink`, `resolveFoundryDataDir`, `createLink`/`removeLink`,
  `readManifest`, and `emitZip` are all importable from `@vttforge/cli`
  for consumers building higher-level tooling.

  **Dependencies** — adds `archiver` (zip emission) pinned to `^7` since
  archiver v8 went ESM-only with renamed exports that DefinitelyTyped
  hasn't caught up to yet.

- 0604375: feat(cli): ship the `vttforge init` scaffolder + four built-in templates

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

## 0.0.1

Initial placeholder release — package name reserved on npm. Implementation lands in v0.3.0.
