---
'@vttforge/cli': patch
---

Ship the template pins that were already corrected.

The templates under `templates/*` name the `@vttforge/*` ranges a scaffolded project starts with. Those pins were kept current in the repo — a guard has caught a stale one eight times — but they were only ever corrected *in the repo*. The templates ride inside this package's tarball, and this package was never released alongside the bumps, so nothing reached anyone.

`pnpm create vttforge` has been scaffolding `@vttforge/core@^0.6.0` while core shipped 0.10.0. A new project could not see sheet registration, text enrichers, or `BaseDocumentSheet`, and its lockfile would resolve a core four minors old.

Templates now pin `@vttforge/core@^0.10.0` and `@vttforge/vite-plugin@^0.4.0`.

The guard also learned the second half: if a release bumps a package the templates pin, it has to include `@vttforge/cli`, or the corrected pin sits in the repo and ships to nobody.
