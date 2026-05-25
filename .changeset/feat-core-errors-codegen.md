---
"@vttforge/core": minor
---

Error registry codegen — `docsUrl` now resolves to a real page.

`postbuild` hook (`packages/core/scripts/codegen-errors.mjs`) reads the
just-built `dist/index.mjs`, calls `listErrorEntries()`, and emits:

- `dist/errors-manifest.json` — versioned JSON catalogue shipped in the
  tarball alongside the bundled JS/types. Stable shape (`version`,
  `package`, `packageVersion`, `entries[]`) so external tooling (the v0.3
  docs site, IDE extensions, lint rules) has a single source of truth.
- `docs/errors/VTTF-NNNN.md` at the repo root — one Markdown stub per code,
  committed so the `docsUrl` already resolves while the full VitePress site
  is being built in v0.3.

New runtime helper: `getErrorManifest()` returns the same data as
`listErrorEntries()`, wrapped in a typed `ErrorManifest` envelope with a
stable `version: 1` field for future format migrations.

Plan deviation: the original `.internal/v0.1-next-steps.md` PR 8 spec said
`prebuild`, but `postbuild` lets the script import the just-built ESM
directly instead of needing `tsx`/`unrun` to load the TS source.
Documented inline in the codegen script.
