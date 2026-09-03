---
"@vttforge/cli": minor
---

`vttforge audit` gains two rules, both for failures a real module shipped.

`VTTF-AUDIT-008` (HIGH) flags a sheet template that opens its own `<form>`. `BaseActorSheet` and `BaseItemSheet` set `tag: 'form'`, so the application element already is one, and a nested form owns the fields inside it: the submit reads the outer element, finds nothing, and every edit is dropped when the window closes. No error, no warning. It only looks at templates those two bases name in their `PARTS`, so a `BaseApplication` that legitimately builds a form is left alone.

`VTTF-AUDIT-009` (MEDIUM) flags a subtype declared in `documentTypes` with no `TYPES` label. Foundry prints the raw key instead, so the sheet is titled `TYPES.Item.my-module.note` and the Create dialog offers the same string in its type dropdown. A label written nested or flattened both count, because Foundry reads both.
