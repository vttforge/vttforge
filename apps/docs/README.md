# @vttforge/docs

The documentation site: VitePress, with its local search.
`scripts/assemble-site.mjs` builds it into `site/docs/`, and it goes live at
<https://vttforge.dev/docs/> with the landing page.

```bash
pnpm --filter @vttforge/docs dev     # local, with hot reload
pnpm --filter @vttforge/docs build   # static HTML
```

## Layout

`src/` holds the version being written and is served at the root of
`/docs/`. Each folder under `archive/` is a frozen copy of an older version,
served at its own path. The Version entry in the navigation moves between
them. To cut a version, copy `src/` into `archive/v<minor>/` and move
`versionsConfig.current` in `.vitepress/config.mts` on.

Two directories under `src/` are generated and not committed. Every core
build writes the error pages under `src/errors/` from the registry in
`@vttforge/core`; edit the registry, not the pages. `scripts/typedoc.mjs`
writes the API reference under `src/reference/`; edit the doc comments in the
package sources.

## Twoslash

A code block tagged `ts twoslash` is compiled by TypeScript at build time
against the packages in `devDependencies`, and renders the types it found on
hover. A block that stops compiling fails the build, which is why the tag is
opt-in and used on a few blocks rather than everywhere.
