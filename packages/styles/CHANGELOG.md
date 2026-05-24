# @vttforge/styles

## 0.1.0

### Minor Changes

- 4900e83: Foundation MVP (PR 4 of 4) — `@vttforge/core` ships its first runtime surface (registerSystem, SystemConfig, BaseTypeDataModel, BaseActorSheet, VttfError + VTTF-NNNN registry) and `@vttforge/styles` ships its first `--vttf-*` token set wrapped in the `vttforge.tokens` cascade layer.

  Both packages have working consumer entrypoints (verified by an external smoke test loading the built `.mjs` from a throwaway dir) and the SDK contracts match the `/foundry-vtt-system-dev` skill (TypeDataModel pitfalls, ActorSheetV2 + HandlebarsApplicationMixin, staged init hooks, marker classes).

  Status remains pre-1.0 and APIs are explicitly unstable — these are the first releases that have real code instead of placeholder `export {}`.

## 0.0.1

Initial functional release (v0.1 MVP slice).

### Added

- `tokens.css` — `--vttf-*` design tokens that fall back to Foundry v13's own `--color-*` / `--font-*` custom properties when present, with literal defaults for non-Foundry environments. Covers text, surfaces, accents, spacing (4-pt grid), radii, and typography.
- Layer order preserved: tokens live under `vttforge.tokens`, leaving `vttforge.reset/.base/.components` empty until v0.1.0.

### Pending

- Real Foundry Theme V2 (`CONST.CSS_THEMES`) binding once we inspect v13.341+ source. Tracked in `plans/TODO.md §3`.
