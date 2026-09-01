---
'@vttforge/core': patch
---

Error code pages are generated for the docs site as well as the repo.

`codegen-errors.mjs` wrote one Markdown stub per code into `docs/errors/`. It now writes the same stubs into `apps/docs/errors/` too — one source, two destinations, so the page a reader lands on from GitHub and the page the site publishes cannot drift.
