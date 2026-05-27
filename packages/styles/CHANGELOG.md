# @vttforge/styles

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

- Real Foundry Theme V2 (`CONST.CSS_THEMES`) binding once we wire that surface in. Tracked in `.internal/TODO.md §3`.
