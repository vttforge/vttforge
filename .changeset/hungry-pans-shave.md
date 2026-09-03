---
'@vttforge/styles': minor
---

Take the component styles out of their cascade sub-layer, so your own CSS and this package's compose the way you expect.

Foundry puts a system's stylesheet in `@layer system` and a module's in `@layer modules`. It does that for you: the manifest's `styles` entry takes an optional `layer`, and when you leave it out the server fills one in. So everything here already sat inside `system`.

Inside it, base, components and the theme sat in `@layer vttforge.*` sub-layers while your own rules, in the same file or your own stylesheet, sat directly in `system`. An unlayered rule beats every layered one in the same layer, whatever the specificity, so your CSS won every time:

```css
/* your stylesheet, in @layer system alongside this package */
button { border-radius: 55px; }   /* used to beat .vttf-btn */
```

Nothing you wrote could lose, which sounds convenient until a broad selector you wrote for one corner silently restyles every component. Now the two compose on specificity, so `.vttf-btn` holds and `.my-system .vttf-btn` wins.

Tokens and the reset stay layered, and lose on purpose. Tokens are custom properties you must be able to override with one plain declaration, and a reset that outranks real rules is a bug waiting to happen.

**This does not change anything about other modules, and should not.** Foundry orders `system` before `modules`, so a module's CSS overrides a system's by design. That ordering is the platform's, not ours.

If you were relying on a plain selector of your own to override these components, raise its specificity.
