---
"@vttforge/cli": patch
---

Audit rule 004 accepts an `HTMLField` or `FilePathField` that `template.json` declares at the document level for a type it lists: while the file exists the server copies that block onto every listed type, so the path is declared. A system generated with a `template.json` no longer gets one finding per rich field.
