---
"@vttforge/cli": minor
---

`vttforge migrate --strict` exits 1 when the run leaves anything that needs a decision, for CI. With `--write`, every file is now rewritten in memory before the first one is written, so a run that throws on one file leaves the tree untouched. A one-line manifest no longer breaks when `"type"` is inserted after `"id"`.
