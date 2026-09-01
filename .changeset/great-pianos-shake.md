---
'@vttforge/cli': patch
---

Say what the scaffolded schemas mean.

The generated number fields declared `required: true` but left `nullable` alone, so they still accepted `null` — and now that the types say so, that shows up as an error the author has to think about. They set `nullable: false`.

The six ability scores share one spec instead of repeating it six times.
