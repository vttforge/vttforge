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

Foundry has already put this file in a layer by the time you see it. A system's stylesheet goes in `@layer system` and a module's in `@layer modules`. The manifest's `styles` entry takes an optional `layer`, and leaving it out lets the server fill one in:

```json
"styles": [{ "src": "styles/my-system.css" }]
```

So the question is never whether these rules are layered. It is how they sort against the rest of what is in that same layer, which is your own CSS.

An unlayered rule beats every layered one in the same layer, whatever the specificity. That is why only `vttforge.tokens` and `vttforge.reset` sit in a sub-layer here, and base, components and the theme do not. Sub-layer the components and this wins every time:

```css
/* your stylesheet, in the same layer as this package */
button { border-radius: 55px; }   /* would beat .vttf-btn */
```

Nothing you wrote could lose, which sounds convenient until a broad selector meant for one corner restyles every component. Unlayered, the two compose on specificity: `.vttf-btn` holds, and `.my-system .vttf-btn` wins.

Tokens and the reset lose that fight on purpose. Tokens are custom properties you must be able to override with one plain declaration, and a reset that outranks real rules is a bug waiting to happen.

None of this affects other modules, and it should not. Foundry orders `system` before `modules`, so a module's CSS overrides a system's by design. You can opt out by setting `"layer": null` on the manifest entry, which makes your stylesheet unlayered and puts it above everything. Do not, unless you have a reason worth the fight: it takes your system out of the order every module author expects.

The `styles.layer.css` entry wraps everything in one `@layer vttforge` nested inside Foundry's. That gives up composing on specificity, in exchange for ordering these styles as a block against layers of your own.

## See it

The design system page shows every token and primitive: <https://vttforge.dev/design-system/>.
