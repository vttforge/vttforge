# @vttforge/types

## 0.2.0

### Minor Changes

- e0941e2: `@vttforge/types` now holds the Foundry surface the base factories stand on: `ApplicationV2Members`, `DocumentSheetV2Members` and `VttforgeClass`. `@vttforge/core` depends on it and re-exports the same names, so nothing changes for a system that imports from core.

## 0.1.3

### Patch Changes

- 7eeeb20: Rewrite the npm package descriptions to say what each package does today. `types` claimed full schema inference it does not have, `vite-plugin` claimed Handlebars HMR that lives in the dev loop, and `cli` did not mention `audit`.

## 0.1.2

### Patch Changes

- 578ba31: Bring the package READMEs in line with what shipped. `core`, `styles`, `types` and `vite-plugin` still described themselves as v0.0.1 placeholders with "planned" features; `cli` did not mention `audit`.
- ae724e3: Read the exported `VTTFORGE_*_VERSION` constants from `package.json` at build time. They were hardcoded and had fallen behind — `vttforge --version` printed `0.1.0` on the 0.5 line.

## 0.1.1

### Patch Changes

- d015aee: Stop requiring Node 26 to install a browser package.
  
  Every package declared `engines.node: ">=26.0.0"`. Four of them — `core`, `styles`, `types` and `dev-module` — compile to ES2022 and run in the browser inside Foundry. They never touch Node, and the floor did nothing except stop anyone on Node 22 LTS from installing the SDK at all.
  
  Those four declare no engine now. `@vttforge/testing` drops to `>=22` — its Quench half runs in the browser too. `@vttforge/cli` and `@vttforge/vite-plugin` keep `>=26`, which is what they actually build against.

## 0.1.0

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

## 0.0.1

Initial placeholder release — package name reserved on npm. Real type surface lands in v1.0.0.
