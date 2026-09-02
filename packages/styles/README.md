# @vttforge/styles

CSS-only package: design tokens, scoped reset, base styles, sheet primitives, and opt-in themes. Built on [CSS Cascade Layers](https://developer.mozilla.org/en-US/docs/Web/CSS/@layer) for predictable composition with Foundry v13's own layer order.

```bash
pnpm add @vttforge/styles
```

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

Opt-in theme:

```css
@import '@vttforge/styles/themes/forge.css';
```

The tokens are also published as data — `@vttforge/styles/tokens.json` — for anything that is not CSS.

## Layer names

VTTForge uses a vendored prefix: `vttforge.tokens`, `vttforge.reset`, `vttforge.base`, `vttforge.components`. Foundry v13 owns the top-level layer names (`reset, variables, elements, blocks, applications, …, system, modules`) and auto-wraps system manifest CSS in its `system` layer.

## See it

The design system page shows every token and primitive: <https://vttforge.dev/design-system/>.
