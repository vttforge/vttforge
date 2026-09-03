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

Cherry-pick:

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

Only two pieces sit in a layer, `vttforge.tokens` and `vttforge.reset`. Base, components and the theme are unlayered on purpose.

The cascade puts every unlayered author rule above every layered one, whatever the specificity. Foundry loads a system or module stylesheet unlayered unless the manifest asks otherwise, so most packages on the page write plain CSS. Put these components in a layer and a bare element selector from an unrelated module wins:

```css
/* some other module, no layer, almost no specificity */
button { border-radius: 99px; }
```

That rule used to beat `.vttf-btn`. Now it does not. Nothing you do with specificity would have won it back, because layer order is decided before specificity is ever consulted.

Tokens and the reset lose that fight on purpose. Tokens are custom properties you must be able to override with one plain declaration. The reset touches bare elements inside `.vttf-app`, and a reset that outranks real rules from the system around it is a bug waiting to happen.

The `styles.layer.css` entry gives up that position by design: inside a layer, VTTForge loses to anything unlayered on the page. Use it only when you need to order these styles against layers of your own.

## See it

The design system page shows every token and primitive: <https://vttforge.dev/design-system/>.
