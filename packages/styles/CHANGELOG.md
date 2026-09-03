# @vttforge/styles

## 0.4.0

### Minor Changes

- e9c184d: Take the component styles out of their cascade sub-layer, so your own CSS and this package's compose the way you expect.
  
  Foundry puts a system's stylesheet in `@layer system` and a module's in `@layer modules`. It does that for you: the manifest's `styles` entry takes an optional `layer`, and when you leave it out the server fills one in. So everything here already sat inside `system`.
  
  Inside it, base, components and the theme sat in `@layer vttforge.*` sub-layers while your own rules, in the same file or your own stylesheet, sat directly in `system`. An unlayered rule beats every layered one in the same layer, whatever the specificity, so your CSS won every time:
  
  ```css
  /* your stylesheet, in @layer system alongside this package */
  button { border-radius: 55px; }   /* used to beat .vttf-btn */
  ```
  
  Nothing you wrote could lose, which sounds convenient until a broad selector you wrote for one corner silently restyles every component. Now the two compose on specificity, so `.vttf-btn` holds and `.my-system .vttf-btn` wins.
  
  Tokens and the reset stay layered, and lose on purpose. Tokens are custom properties you must be able to override with one plain declaration, and a reset that outranks real rules is a bug waiting to happen.
  
  **This does not change anything about other modules, and should not.** Foundry orders `system` before `modules`, so a module's CSS overrides a system's by design. That ordering is the platform's, not ours.
  
  If you were relying on a plain selector of your own to override these components, raise its specificity.

## 0.3.3

### Patch Changes

- 7eeeb20: Rewrite the npm package descriptions to say what each package does today. `types` claimed full schema inference it does not have, `vite-plugin` claimed Handlebars HMR that lives in the dev loop, and `cli` did not mention `audit`.

## 0.3.2

### Patch Changes

- 578ba31: Bring the package READMEs in line with what shipped. `core`, `styles`, `types` and `vite-plugin` still described themselves as v0.0.1 placeholders with "planned" features; `cli` did not mention `audit`.

## 0.3.1

### Patch Changes

- d015aee: Stop requiring Node 26 to install a browser package.
  
  Every package declared `engines.node: ">=26.0.0"`. Four of them — `core`, `styles`, `types` and `dev-module` — compile to ES2022 and run in the browser inside Foundry. They never touch Node, and the floor did nothing except stop anyone on Node 22 LTS from installing the SDK at all.
  
  Those four declare no engine now. `@vttforge/testing` drops to `>=22` — its Quench half runs in the browser too. `@vttforge/cli` and `@vttforge/vite-plugin` keep `>=26`, which is what they actually build against.

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

## 0.2.0

### Minor Changes

- 45b9547: Generate `dist/tokens.css` from W3C DTCG `tokens.json` via Style Dictionary 4. Ships the Forge token set (warm-dark + ember accent) as the default, with light overrides at `[data-theme="light"]` and an opt-in Foundry Theme V2 mapping at `[data-theme="foundry"]`.

  `@vttforge/styles/tokens.css` now resolves to the generated output. The previous placeholder `tokens.css` (Foundry-only fallback) is removed.

- 6bde407: Ship the full primitive set adapted from the Design System spec:
  - `reset.css`: scoped reset for `.vttf-app`, `.vttf-sheet`, `form[data-vttf]` (does not override Foundry's `reset` layer).
  - `base.css`: element baselines, focus-ring rendering, `.vttf-sr-only` utility.
  - `components.css`: buttons (primary/secondary/ghost/danger), badges (7 hues), code block with syntax tokens (`.vttf-tk-*`), inputs/textarea/select with ARIA invalid state, checkbox/radio/switch/range/segmented control, tabs with ARIA selected, sheet primitives (`.vttf-sheet`, `.vttf-sheet__head`, `.vttf-sheet__body`, `.vttf-portrait`, `.vttf-stat-pill`, `.vttf-dropzone`, `.vttf-item-row`).
  - `themes/forge.css`: adds `@media (prefers-color-scheme: light) [data-theme="auto"]` so `data-theme="auto"` follows the GM's OS preference. Explicit `data-theme="light"` and `data-theme="foundry"` continue to be handled by `tokens.css`.
  - `preview/index.html`: Storybook-lite page that renders every primitive with a theme toggle (dark → light → foundry → auto).

  Translucent tints use `color-mix(in oklch, var(--vttf-ember) 8%, transparent)` (HANDOFF §5) so re-theming the ember token propagates automatically. States use ARIA attributes first (`aria-selected`, `aria-invalid`, `aria-pressed`) with `.is-*` classes as fallback. `:focus-visible` is owned by the base layer.

  Adds the `vttforge.themes` cascade sub-layer and bumps the layer order in both entry points.

## 0.1.0

### Minor Changes

- 4900e83: Foundation MVP (PR 4 of 4) — `@vttforge/core` ships its first runtime surface (registerSystem, SystemConfig, BaseTypeDataModel, BaseActorSheet, VttfError + VTTF-NNNN registry) and `@vttforge/styles` ships its first `--vttf-*` token set wrapped in the `vttforge.tokens` cascade layer.

  Both packages have working consumer entrypoints (verified by an external smoke test loading the built `.mjs` from a throwaway dir) and the SDK contracts match the canonical Foundry v13 patterns (TypeDataModel migration, ActorSheetV2 + HandlebarsApplicationMixin, staged init hooks, marker classes).

  Status remains pre-1.0 and APIs are explicitly unstable — these are the first releases that have real code instead of placeholder `export {}`.

## 0.0.1

Initial functional release (v0.1 MVP slice).

### Added

- `tokens.css` — `--vttf-*` design tokens that fall back to Foundry v13's own `--color-*` / `--font-*` custom properties when present, with literal defaults for non-Foundry environments. Covers text, surfaces, accents, spacing (4-pt grid), radii, and typography.
- Layer order preserved: tokens live under `vttforge.tokens`, leaving `vttforge.reset/.base/.components` empty until v0.1.0.

### Pending

- Real Foundry Theme V2 (`CONST.CSS_THEMES`) binding once we wire that surface in.
