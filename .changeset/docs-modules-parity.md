---
'@vttforge/core': patch
'@vttforge/cli': patch
---

Document what a module gets. The package READMEs list `registerSocket`,
`moduleApi`, `convertSubTypes` and `inject`, which shipped without reaching
any of the places a reader looks first. The core README still named
`SystemConfig`, renamed two releases ago. The CLI README's audit list was
missing the rule for socket use with no `"socket": true` in the manifest.
