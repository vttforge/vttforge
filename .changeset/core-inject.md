---
'@vttforge/core': minor
---

`inject()`: put a package's own UI inside an application it does not own.

Most of what a module does, and there is no API for it. Foundry re-renders an
application whenever its document changes, so the insert repeats, and every
module writes the same guard by hand.

`inject` marks what it inserted with `data-vttforge-injection="<id>.<name>"`
and removes the previous one before inserting again, so ten renders leave one
node. Two packages using the same name do not collide. It normalises the
element, because most render hooks pass an `HTMLElement` and the deprecated
`renderChatMessage` passes jQuery. It returns a function that unbinds, which
nothing else does.

New error code VTTF-0016.
