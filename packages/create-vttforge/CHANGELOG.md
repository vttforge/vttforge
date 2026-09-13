# create-vttforge

## 0.3.33

### Patch Changes

- Updated dependencies [dbd991a]
  - @vttforge/cli@0.18.2

## 0.3.32

### Patch Changes

- Updated dependencies [6957129]
  - @vttforge/cli@0.18.1

## 0.3.31

### Patch Changes

- Updated dependencies [9ae404a]
- Updated dependencies [fef514a]
- Updated dependencies [c34b8ca]
  - @vttforge/cli@0.18.0

## 0.3.30

### Patch Changes

- Updated dependencies [712edb3]
  - @vttforge/cli@0.17.2

## 0.3.29

### Patch Changes

- Updated dependencies [11bf7b5]
  - @vttforge/cli@0.17.1

## 0.3.28

### Patch Changes

- Updated dependencies [eb61b51]
  - @vttforge/cli@0.17.0

## 0.3.27

### Patch Changes

- Updated dependencies [3c56de9]
- Updated dependencies [14b29cc]
- Updated dependencies [86b64fa]
- Updated dependencies [ac59e0a]
- Updated dependencies [a5623a0]
- Updated dependencies [7e77931]
  - @vttforge/cli@0.16.0

## 0.3.26

### Patch Changes

- Updated dependencies [6ad9da6]
- Updated dependencies [e5567cb]
- Updated dependencies [e5567cb]
  - @vttforge/cli@0.15.3

## 0.3.25

### Patch Changes

- Updated dependencies [12aae87]
- Updated dependencies [1b42a83]
- Updated dependencies [12aae87]
  - @vttforge/cli@0.15.2

## 0.3.24

### Patch Changes

- Updated dependencies [27812a5]
  - @vttforge/cli@0.15.1

## 0.3.23

### Patch Changes

- Updated dependencies [665c148]
  - @vttforge/cli@0.15.0

## 0.3.22

### Patch Changes

- f8ecf14: Plainer wording in the READMEs, the scaffolded project READMEs and the default messages of the `VTTF-NNNN` errors. No code change.
- Updated dependencies [66f86d3]
- Updated dependencies [f8ecf14]
  - @vttforge/cli@0.14.1

## 0.3.21

### Patch Changes

- Updated dependencies [669be2c]
  - @vttforge/cli@0.14.0

## 0.3.20

### Patch Changes

- Updated dependencies [de3671e]
- Updated dependencies [2a8e892]
  - @vttforge/cli@0.13.0

## 0.3.19

### Patch Changes

- Updated dependencies [3e57887]
  - @vttforge/cli@0.12.0

## 0.3.18

### Patch Changes

- Updated dependencies [5aae89d]
- Updated dependencies [4361bcd]
- Updated dependencies [89f9013]
- Updated dependencies [66aaf98]
  - @vttforge/cli@0.11.0

## 0.3.17

### Patch Changes

- Updated dependencies [60d3222]
  - @vttforge/cli@0.10.1

## 0.3.16

### Patch Changes

- Updated dependencies [11afe13]
- Updated dependencies [c7a9920]
  - @vttforge/cli@0.10.0

## 0.3.15

### Patch Changes

- Updated dependencies [2224420]
  - @vttforge/cli@0.9.0

## 0.3.14

### Patch Changes

- Updated dependencies [0034209]
  - @vttforge/cli@0.8.1

## 0.3.13

### Patch Changes

- Updated dependencies [89b7ffa]
  - @vttforge/cli@0.8.0

## 0.3.12

### Patch Changes

- Updated dependencies [7920fa2]
  - @vttforge/cli@0.7.1

## 0.3.11

### Patch Changes

- Updated dependencies [4f81bfd]
- Updated dependencies [7169a30]
- Updated dependencies [e9c184d]
  - @vttforge/cli@0.7.0

## 0.3.10

### Patch Changes

- Updated dependencies [65e8c13]
- Updated dependencies [65e8c13]
  - @vttforge/cli@0.6.0

## 0.3.9

### Patch Changes

- Updated dependencies [8a7ade5]
  - @vttforge/cli@0.5.6

## 0.3.8

### Patch Changes

- Updated dependencies [9b8ca8c]
  - @vttforge/cli@0.5.5

## 0.3.7

### Patch Changes

- Updated dependencies [7eeeb20]
  - @vttforge/cli@0.5.4

## 0.3.6

### Patch Changes

- Updated dependencies [578ba31]
- Updated dependencies [8fef09a]
- Updated dependencies [ae724e3]
  - @vttforge/cli@0.5.3

## 0.3.5

### Patch Changes

- Updated dependencies [e55a6dc]
  - @vttforge/cli@0.5.2

## 0.3.4

### Patch Changes

- Updated dependencies [57af020]
  - @vttforge/cli@0.5.1

## 0.3.3

### Patch Changes

- Updated dependencies [11187a0]
- Updated dependencies [353633c]
- Updated dependencies [3eb8c96]
- Updated dependencies [c24b2e9]
  - @vttforge/cli@0.5.0

## 0.3.2

### Patch Changes

- Updated dependencies [17a6b8c]
  - @vttforge/cli@0.4.0

## 0.3.1

### Patch Changes

- Updated dependencies [1fb967d]
- Updated dependencies [5b72b4b]
- Updated dependencies [c90357e]
  - @vttforge/cli@0.3.0

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
