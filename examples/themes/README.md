# Example themes

Forge is `@vttforge/styles`'s official theme. The four files in this folder are documented examples that show how to compose a custom theme on top of `@vttforge/styles` by overriding `--vttf-*` tokens.

| File | Reference |
| --- | --- |
| `codex.css` | D&D 5e modern — burgundy + cream serif. |
| `parchment.css` | OGL / OSR print-style — walnut ink, square edges. |
| `grimdark.css` | Warhammer / Mörk Borg / CoC — near-black, condensed sans, dried-blood accent. |
| `neon.css` | Shadowrun / Cyberpunk — deep blue, magenta + cyan, mono display. |

## Usage

```html
<link rel="stylesheet" href="@vttforge/styles" />
<link rel="stylesheet" href="examples/themes/codex.css" />

<div class="vttf-sheet vttf-theme-codex">
  <!-- sheet content uses Codex token values automatically -->
</div>
```

Each file is one CSS class. Drop it on the sheet root, the components re-theme. No other markup changes required.

## Authoring your own theme

1. Copy any of the four files.
2. Rename the class (`.vttf-theme-yourname`).
3. Replace token values. The ones to override:
   - Surfaces: `--vttf-bg`, `--vttf-bg-elevated`, `--vttf-bg-sunken`, `--vttf-surface`, `--vttf-surface-2`, `--vttf-border`, `--vttf-border-strong`.
   - Text: `--vttf-text`, `--vttf-text-muted`, `--vttf-text-faint`, `--vttf-text-inverse`.
   - Accent: `--vttf-ember`, `--vttf-ember-deep`, `--vttf-ember-glow`.
   - Optional: semantic accents (`--vttf-steel`, `--vttf-mint`, `--vttf-gold`, `--vttf-rose`, `--vttf-violet`), fonts (`--vttf-font-display`, `--vttf-font-body`, `--vttf-font-mono`), radii (`--vttf-radius-sm`/`-md`/`-lg`/`-xl`).
4. Drop the class on a sheet root and verify in your system.

Do not touch component CSS. Re-theming via tokens is the whole point.
