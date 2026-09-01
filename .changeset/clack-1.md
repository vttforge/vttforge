---
'@vttforge/cli': patch
---

Move the prompts to `@clack/prompts` 1.x, and fix a validator that let a
missing package id through.

Clack 1.x hands validators `string | undefined` instead of `string`, since
it calls them before anything is typed. Widening the signatures surfaced a
latent bug in the package-id check: it called `RegExp.test` on the raw
value, and an undefined value coerces to the string `"undefined"`, which
matches the allowed pattern. A missing id therefore passed validation. The
check now coalesces first.

The three validators are exported and covered by tests. They were only
reachable through the interactive prompt before, so nothing exercised them.
