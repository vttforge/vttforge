---
'@vttforge/styles': minor
---

Ship the full primitive set adapted from the Design System spec:

- `reset.css`: scoped reset for `.vttf-app`, `.vttf-sheet`, `form[data-vttf]` (does not override Foundry's `reset` layer).
- `base.css`: element baselines, focus-ring rendering, `.vttf-sr-only` utility.
- `components.css`: buttons (primary/secondary/ghost/danger), badges (7 hues), code block with syntax tokens (`.vttf-tk-*`), inputs/textarea/select with ARIA invalid state, checkbox/radio/switch/range/segmented control, tabs with ARIA selected, sheet primitives (`.vttf-sheet`, `.vttf-sheet__head`, `.vttf-sheet__body`, `.vttf-portrait`, `.vttf-stat-pill`, `.vttf-dropzone`, `.vttf-item-row`).
- `themes/forge.css`: adds `@media (prefers-color-scheme: light) [data-theme="auto"]` so `data-theme="auto"` follows the GM's OS preference. Explicit `data-theme="light"` and `data-theme="foundry"` continue to be handled by `tokens.css`.
- `preview/index.html`: Storybook-lite page that renders every primitive with a theme toggle (dark → light → foundry → auto).

Translucent tints use `color-mix(in oklch, var(--vttf-ember) 8%, transparent)` (HANDOFF §5) so re-theming the ember token propagates automatically. States use ARIA attributes first (`aria-selected`, `aria-invalid`, `aria-pressed`) with `.is-*` classes as fallback. `:focus-visible` is owned by the base layer.

Adds the `vttforge.themes` cascade sub-layer and bumps the layer order in both entry points.
