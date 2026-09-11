---
'@vttforge/core': minor
---

`subTypeDocuments()` and `convertSubTypes()`: a way out for a module's
documents before the module goes away.

A module's sub-types travel with the module. Switch it off and every document
using one is invalid; uninstall it and they are stranded. Foundry says to ship
a conversion path, and every module that ships one writes it from scratch.

`subTypeDocuments()` answers what a user would lose. `convertSubTypes()` turns
each one into another type, one update each, in place: the id survives, and so
do the flags, the folder, the ownership and the embedded documents.

The shape of that update is the part worth having written down.
`update({ type })` on its own is refused, and Foundry drops the whole update
with it, so a call that also renamed the document loses the rename. Creating a
replacement with `keepId` while the original still exists overwrites it, with
no error and no second document.

New error code VTTF-0015.
