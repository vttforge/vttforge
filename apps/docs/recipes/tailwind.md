# Tailwind in a Foundry package

Tailwind works inside a Foundry system or module. Three things go wrong by
default, and each has a one-line fix.

## Turn preflight off

Tailwind's reset restyles every element on the page. Inside Foundry that
means the sidebar, the chat log and every other package's sheet, because
your stylesheet loads into the same document.

```js
// tailwind.config.mjs
export default {
  content: ['./scripts/**/*.{ts,mjs}', './templates/**/*.hbs'],
  corePlugins: { preflight: false },
};
```

`@vttforge/styles` already ships a reset scoped to its own layer, so nothing
is lost.

## Scope the utilities

Even without preflight, a utility like `.flex` is global. Two packages that
both ship Tailwind fight over it. Give yours a prefix, or scope the whole
build under your package class:

```js
export default {
  prefix: 'my-',            // <div class="my-flex my-gap-2">
  important: '.my-system',  // or: every rule becomes .my-system .flex
};
```

The prefix is the safer of the two. `important` raises specificity, which
is what cascade layers exist to avoid.

## Point `content` at the templates

Tailwind only emits the classes it finds. Handlebars templates are where
most of yours live, so list them, and list the scripts that build markup by
hand.

## Wire it up

Vite runs PostCSS on its own, so the plugin needs no extra config:

```js
// postcss.config.mjs
export default { plugins: { tailwindcss: {}, autoprefixer: {} } };
```

```css
/* styles/main.css */
@import '@vttforge/styles';
@tailwind utilities;
```

Only `utilities`. `base` is preflight under another name, and `components`
is empty until you add to it.

## Keep the tokens

Tailwind's colour scale and VTTForge's tokens can coexist. Map the ones you
use so a theme change reaches your utilities too:

```js
theme: {
  extend: {
    colors: {
      ember: 'var(--vttf-ember)',
      surface: 'var(--vttf-surface)',
    },
  },
},
```

Now `my-bg-surface` follows the theme, and a custom theme built the way
[the theme recipe](/recipes/custom-theme) describes restyles it for free.
