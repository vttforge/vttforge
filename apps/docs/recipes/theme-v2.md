# Binding to Foundry's Theme V2

Foundry v13 ships CSS custom properties that follow the user's light/dark
choice. Using them means your package changes with the rest of the interface
instead of fighting it.

```css
@layer my-package {
  .my-window {
    color: var(--color-text-primary);
    background: var(--color-bg-primary);
    border: 1px solid var(--color-border);
    font-family: var(--font-primary);
  }
}
```

| Category | Variables |
|---|---|
| Text | `--color-text-primary`, `--color-text-secondary`, `--color-text-hyperlink` |
| Background | `--color-bg-primary`, `--color-bg-secondary`, `--color-bg-tertiary` |
| Borders | `--color-border`, `--color-border-light`, `--color-border-dark` |
| Warm accents | `--color-warm-1`, `--color-warm-2`, `--color-warm-3` |
| Cool accents | `--color-cool-1`, `--color-cool-2`, `--color-cool-3` |

## Use a cascade layer

v13 uses `@layer`. Wrapping your CSS in a named layer means a game system can
override you without anyone writing `!important`, and means you do not
accidentally outrank Foundry's own rules by specificity.

`@vttforge/styles` publishes under `vttforge.*`. Pick your own package id as
the layer name, never `system`, which Foundry owns.

## Give every variable a fallback

```css
color: var(--color-text-primary, #f0f0e0);
```

Your CSS may load in a context where Foundry's variables are not defined (a
preview page, a screenshot tool, a test harness), and a missing custom
property makes the declaration invalid rather than falling back to inherited.
