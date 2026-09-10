---
"@vttforge/cli": minor
---

`vttforge migrate --strict` exits 1 when the run leaves anything that needs a decision, for CI. With `--write`, every file is now rewritten in memory before the first one is written, so a run that throws on one file leaves the tree untouched. A one-line manifest no longer breaks when `"type"` is inserted after `"id"`. The JSON report's `dataModels` and `sheets` blocks gain a `decisions` list next to `notes`: `notes` say what happened, `decisions` what still needs a hand, and only the second fails `--strict`.
