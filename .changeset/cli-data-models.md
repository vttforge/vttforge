---
'@vttforge/cli': minor
---

`vttforge migrate --data-models` writes a data model per `template.json` type: one class per type, one function per shared template that the types spread, the `documentTypes` block for the manifest and the registration for `init`. `--style plain` needs nothing installed; `--style sdk` builds on `@vttforge/core`. What it guessed (empty arrays, nulls, a template a type lists that is not defined) it reports.
