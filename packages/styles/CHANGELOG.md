# @vttforge/styles

## 0.0.1

Initial functional release (v0.1 MVP slice).

### Added

- `tokens.css` — `--vttf-*` design tokens that fall back to Foundry v13's own `--color-*` / `--font-*` custom properties when present, with literal defaults for non-Foundry environments. Covers text, surfaces, accents, spacing (4-pt grid), radii, and typography.
- Layer order preserved: tokens live under `vttforge.tokens`, leaving `vttforge.reset/.base/.components` empty until v0.1.0.

### Pending

- Real Foundry Theme V2 (`CONST.CSS_THEMES`) binding once we inspect v13.341+ source. Tracked in `.internal/TODO.md §3`.
