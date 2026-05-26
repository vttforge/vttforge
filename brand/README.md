# VTTForge brand assets

The mark is `{ d20 }` — curly braces signal code, the icosahedron between them signals where that code runs.

## Files

| File | Purpose |
| --- | --- |
| `logo.svg` | Full-color primary mark. 32×32 viewBox. Use everywhere. |
| `logo-mono.svg` | Single-color version (`currentColor`). For 1-color printing, embroidery, screen-print. |
| `favicon.svg` | Plated mark on warm-dark backdrop. For browser tabs. |
| `favicon-32.png` | 32×32 raster fallback for legacy browsers. |
| `apple-touch-icon.png` | 180×180 plated raster. iOS/iPadOS home screen. |
| `logo-512.png` | 512×512 transparent raster. Open Graph, social, hi-res docs. |

## The four official colors

The mark uses exactly four colors. Anything else is off-brand.

| Token | OKLCH | sRGB |
| --- | --- | --- |
| `--ember-glow` | `oklch(0.815 0.130 60)` | `#ffad67` |
| `--ember` | `oklch(0.715 0.170 48)` | `#f57c33` |
| `--ember-deep` | `oklch(0.520 0.160 38)` | `#b13c11` |
| `--text-muted` | `oklch(0.745 0.012 70)` | `#b1aba4` |

SVG attributes ship as sRGB hex for universal rasterizer support. Modern surfaces should override to OKLCH via `@vttforge/styles` tokens for wide-gamut display fidelity.

The favicon plate uses a fifth color (`#130d0a` warm-dark) as backdrop, not part of the mark.

## Lockups

The wordmark is always Bricolage Grotesque 700, with `VTT` in `var(--ember)`.

**Horizontal lockup** — mark 56×56 + wordmark 40px, gap 16px, tracking -0.03em.
**Stacked lockup** — mark 72×72 + wordmark 28px below, gap 16px, tracking -0.02em.
**Inline (nav)** — mark 30×30 + wordmark 20px, gap 8px, tracking -0.02em.

## Approved backgrounds

The full-color mark sits on four approved surfaces:

1. `bg` warm-dark: `oklch(0.165 0.012 50)`
2. `paper` warm-light: `oklch(0.985 0.004 80)`
3. `bg-sunken` near-black: `oklch(0.125 0.010 50)`
4. ember gradient: `oklch(0.520 0.160 38)` → `oklch(0.715 0.170 48)` (use `logo-mono.svg` with `color: white`)

Don't recolor the mark for other backgrounds.

## Don'ts

- Don't stretch or skew. Preserve 1:1 aspect ratio.
- Don't rotate. Braces and d20 always upright.
- Don't drop the d20 between the braces.
- Don't place on busy, high-chroma, or clashing backgrounds.

## Size scale

| Size | Use |
| --- | --- |
| 128px+ | Hero, splash, OG cards. |
| 64px | Documentation headers, large card art. |
| 40px | Section icons, large inline contexts. |
| 24px | Buttons, list items. |
| 16px | Tab strips, dense UI. |
| <12px | Switch to `favicon.svg` plated. The raw mark loses legibility. |

## Regenerating PNG rasters

```sh
rsvg-convert brand/favicon.svg -w 32 -h 32 -o brand/favicon-32.png
rsvg-convert brand/favicon.svg -w 180 -h 180 -o brand/apple-touch-icon.png
rsvg-convert brand/logo.svg -w 512 -h 512 -o brand/logo-512.png
```

Requires `librsvg` (`brew install librsvg`).
