---
'@vttforge/cli': patch
---

`vttforge migrate` no longer renames the keys of a Dialog button, or of a class body that happens to hold a context-menu entry. An entry is an object whose own keys include `callback` and `name` or `condition`; a button has `icon`, `label` and `callback`, and keeps `callback` on v14.
