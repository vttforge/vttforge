---
'@vttforge/styles': minor
---

Take the component styles out of their cascade layer, so plain CSS from another package cannot restyle your sheet.

Base, components and the theme used to sit in `@layer vttforge.*`. That was a mistake. An unlayered rule beats every layered one, whatever the specificity, and layer order is settled before specificity is ever consulted. Foundry loads a system or module stylesheet unlayered unless the manifest asks otherwise, so most packages on the page write plain CSS. One of them shipping this:

```css
button { border-radius: 99px; }
```

used to win against `.vttf-btn`, and nothing you could write would win it back.

Tokens and the reset stay layered, and lose on purpose. Tokens are custom properties you must be able to override with one plain declaration, and a reset that outranks real rules is a bug waiting to happen.

The `styles.layer.css` entry still wraps everything in one `@layer vttforge` for consumers who order these styles against layers of their own. It gives up the cascade position by design.

If you were relying on `@layer vttforge.base`, `vttforge.components` or `vttforge.themes` to keep these styles below your own unlayered CSS, that no longer holds. Raise the specificity of your override, or import `styles.layer.css` instead.
