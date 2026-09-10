# @vttforge/styles

CSS-only package: design tokens, scoped reset, base styles, sheet primitives, and opt-in themes.

```bash
pnpm add @vttforge/styles
```

## Usage

Default, one import:

```css
@import '@vttforge/styles';
```

Or wrap everything in a single `@layer vttforge` you order yourself:

```css
@layer reset, vttforge, my-system;
@import '@vttforge/styles/styles.layer.css';
```

Read the next section before you pick the second one.

Pick what you need:

```css
@import '@vttforge/styles/tokens.css';
@import '@vttforge/styles/components.css';
```

Opt-in theme:

```css
@import '@vttforge/styles/themes/forge.css';
```

The tokens are also published as data, `@vttforge/styles/tokens.json`, for anything that is not CSS.

## Cascade layers

Foundry has already put this file in a layer by the time you see it. A system's stylesheet goes in `@layer system` and a module's in `@layer modules`. The manifest's `styles` entry takes an optional `layer`, and leaving it out lets the server fill one in:

```json
"styles": [{ "src": "styles/my-system.css" }]
```

These rules are layered either way. What varies is how they sort against the rest of that layer, which is your own CSS.

An unlayered rule beats every layered one in the same layer, whatever the specificity. Only `vttforge.tokens` and `vttforge.reset` sit in a sub-layer here; base, components and the theme do not. Sub-layer the components and this would win every time:

```css
/* your stylesheet, in the same layer as this package */
button { border-radius: 55px; }   /* would beat .vttf-btn */
```

Nothing you wrote could lose, so a broad selector meant for one corner would restyle every component. Unlayered, the two compose on specificity: `.vttf-btn` holds, and `.my-system .vttf-btn` wins.

Tokens and the reset are sub-layered on purpose. Tokens are custom properties, so one plain declaration has to override them, and a reset should never outrank a real rule.

The sub-layering above only sorts these rules against your own CSS. Between packages, Foundry orders `system` before `modules`, so a module's CSS overrides a system's by design. Setting `"layer": null` on the manifest entry makes your stylesheet unlayered and puts it above everything, including every module. That also takes your system out of the order module authors expect, so it needs a reason.

The `styles.layer.css` entry wraps everything in one `@layer vttforge` nested inside Foundry's. Specificity no longer composes between these styles and yours; instead the block sorts as a whole against layers you declare.

## Design system

The design system page shows every token and primitive: <https://vttforge.dev/design-system/>.
