# A theme of your own

`@vttforge/styles` ships one theme, Forge. Every colour, font and radius in it
is a `--vttf-*` custom property, and the component CSS reads only those. So a
theme is a class that sets the tokens; the components follow.

## Start from an example

The repo carries four in `examples/themes/`: Codex (5e modern, burgundy and
cream), Parchment (OSR print), Grimdark (near-black, dried-blood accent) and
Neon (cyberpunk). Each is one class:

```css
.vttf-theme-codex {
  --vttf-bg: #f5efe2;
  --vttf-surface: #fbf7ec;
  --vttf-border: #d6c8a8;
  --vttf-text: #2a1a14;
  --vttf-text-muted: #6b554a;
  --vttf-ember: #8a1a1f;
  --vttf-ember-deep: #5a1115;
  --vttf-font-display: "Cinzel", "Times New Roman", serif;
  --vttf-font-body: "Cormorant Garamond", "Times New Roman", serif;
  --vttf-radius-md: 3px;
}
```

Copy one, rename the class, change the values. Then put the class on the
sheet root:

```ts
static DEFAULT_OPTIONS = {
  classes: ['my-system', 'sheet', 'actor', 'vttf-theme-codex'],
};
```

Nothing else changes. The tabs, the pills, the inputs and the buttons all
read the tokens from the nearest ancestor that sets them.

## The tokens to set

| Group | Tokens |
|---|---|
| Surfaces | `--vttf-bg`, `--vttf-bg-elevated`, `--vttf-bg-sunken`, `--vttf-surface`, `--vttf-surface-2`, `--vttf-border`, `--vttf-border-strong` |
| Text | `--vttf-text`, `--vttf-text-muted`, `--vttf-text-faint`, `--vttf-text-inverse` |
| Accent | `--vttf-ember`, `--vttf-ember-deep`, `--vttf-ember-glow` |
| Optional | `--vttf-steel`, `--vttf-mint`, `--vttf-gold`, `--vttf-rose`, `--vttf-violet`; `--vttf-font-display`, `--vttf-font-body`, `--vttf-font-mono`; `--vttf-radius-sm` through `--vttf-radius-xl` |

The full list, with the Forge values, is in `@vttforge/styles/tokens.json`
and on the [design system page](https://vttforge.dev/design-system/).

## Two rules

**Do not restyle components.** If a button looks wrong in your theme, the
fix is a token, not a `.vttf-button` override. Component CSS is what the
package updates; a token is a contract.

**Set every token you care about.** A theme that only sets `--vttf-bg`
inherits Forge's text colour, and Forge is dark. Set the surfaces and the
text together, or the sheet is unreadable in one of the two.

## Following the GM's theme

To follow Foundry's own light and dark setting instead of shipping a fixed
theme, see [Binding to Foundry's Theme V2](/recipes/theme-v2).
