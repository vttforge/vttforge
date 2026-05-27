# @vttforge/styles

CSS-only package: design tokens, scoped reset, base styles, sheet primitives, and opt-in themes. Built on [CSS Cascade Layers](https://developer.mozilla.org/en-US/docs/Web/CSS/@layer) for predictable composition with Foundry v13's own layer order.

> **Status:** v0.0.1 placeholder. Token contract finalizes in v0.1.0 once Foundry v13+ `CONST.CSS_THEMES` is wired in.

## Usage

Default — one import, sub-layered:

```css
@import '@vttforge/styles';
```

Mantine-style — wrap everything in a single `@layer vttforge`:

```css
@import '@vttforge/styles/styles.layer.css';
```

Cherry-pick:

```css
@import '@vttforge/styles/tokens.css';
@import '@vttforge/styles/components.css';
```

## Layer names

VTTForge uses a vendored prefix: `vttforge.tokens`, `vttforge.reset`, `vttforge.base`, `vttforge.components`. Foundry v13 owns the top-level layer names (`reset, variables, elements, blocks, applications, …, system, modules`) and auto-wraps system manifest CSS in its `system` layer.
