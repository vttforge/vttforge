---
'@vttforge/core': minor
---

An `api` option on `registerModule()`, and helpers for reading another
package's.

`api` is written to `game.modules.get(id).api` at the top of `init`, before
your own `onBeforeInit` and before any CONFIG mutation. That hook is the part
people get wrong: publish it later and anything that looked during its own
`init` found nothing.

`moduleApi(id)` hands back another module's api or `undefined`.
`requireModuleApi(id)` throws VTTF-0014 and says which of four things is
wrong: Foundry has no module list yet, the module is not installed, it is
installed and switched off, or it is on and has not published. The bare read
collapses all four into `undefined`, which is how a module ends up telling its
user to install something they already have. `isModuleActive(id)` answers the
narrower question.

Read another package's api from `onSetup` or later. Nothing orders one
package's `init` against another's.

New error code VTTF-0014.
