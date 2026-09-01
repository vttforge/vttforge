# @vttforge/cli

## 0.2.0

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

## 0.1.1

### Patch Changes

- 5f03da9: Move to citty 0.2 and cover argument parsing with tests.

  citty 0.2 is ESM-only, drops its runtime dependencies, and rewrites the
  parser on top of `node:util.parseArgs`. Parsing behaviour is unchanged for
  every flag this CLI defines — negation, aliases, positionals, `--flag=value`
  and boolean defaults all produce identical results on 0.1.6 and 0.2.2.

  The command tree moves from `bin.ts` to `cli.ts`, leaving the bin as the
  launch only. The definitions were unreachable from tests before, because a
  module that calls `runMain` on import runs the CLI. They are now covered,
  including `--no-install` and `--no-git`, which would have made the
  scaffolder install dependencies for someone who asked it not to had the
  parser rewrite changed them.

## 0.1.0

### Minor Changes

- 139802c: feat(cli): ship `vttforge audit` — scan for seven v13 footguns

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

- 09de435: feat(cli): ship `vttforge dev` and `vttforge build`

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

- 4d34985: Move to Vite 8.

  The plugin's `vite` peer range now reads `^8.2.2`, so a project still on
  Vite 6 or 7 will not satisfy it. The four `vttforge init` templates move
  with it, which keeps a freshly scaffolded project free of a peer conflict.

  The plugin itself needed no code change — it uses only the `config` hook
  and the `Plugin` and `UserConfig` types, all unchanged across the two
  majors.

### Patch Changes

- 6e36de2: Move the release-zip writer to archiver 8.

  Archiver 8 is ESM-only and dropped its default export, so the old
  `archiver('zip', options)` factory call is gone. The writer now builds the
  named `ZipArchive` class directly. Same options, same output: package
  contents sit at the zip root with no wrapper folder, and LICENSE, README
  and CHANGELOG still ride along from the project root when present.

- edd88fe: Move the prompts to `@clack/prompts` 1.x, and fix a validator that let a
  missing package id through.

  Clack 1.x hands validators `string | undefined` instead of `string`, since
  it calls them before anything is typed. Widening the signatures surfaced a
  latent bug in the package-id check: it called `RegExp.test` on the raw
  value, and an undefined value coerces to the string `"undefined"`, which
  matches the allowed pattern. A missing id therefore passed validation. The
  check now coalesces first.

  The three validators are exported and covered by tests. They were only
  reachable through the interactive prompt before, so nothing exercised them.

- 4ba725c: Point the scaffolding templates at the versions this release publishes.

  The templates asked for `@vttforge/core@^0.3.0` and
  `@vttforge/vite-plugin@^0.1.0`. On a 0.x version a caret pins the minor, so
  `^0.3.0` means `>=0.3.0 <0.4.0` — and this release takes core to 0.4.0 and
  the plugin to 0.2.0. Left alone, every project scaffolded after the release
  would ask for versions the release had just superseded.

## 0.0.1

Initial placeholder release — package name reserved on npm. Implementation lands in v0.3.0.
