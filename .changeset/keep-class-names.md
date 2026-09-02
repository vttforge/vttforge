---
'@vttforge/vite-plugin': minor
---

Keep class names through minification.

Foundry reads class names at runtime, and a minifier does not promise the same one twice. The clearest case is a registered sheet: Foundry keys it by `${package id}.${class name}` and saves that key on every document using it, so a rename between builds orphans the reader's choice. `registerSheets` fixes the name for that case.

Everything else stayed minified. A stack trace named `mo`. An `instanceof` error message named `t`. Someone debugging a sheet that renders nothing read a prototype chain of `go → r → HandlebarsApplication` and had to work out which of those was theirs.

Builds now pass `keepNames` to rolldown, so a class reports the name it was written with.

This complements the explicit sheet id rather than replacing it: a rename in your own source would still move a key that was inferred from the class name.
