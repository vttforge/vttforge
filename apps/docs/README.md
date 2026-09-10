# @vttforge/docs

The documentation site: VitePress, with its local search.
`scripts/assemble-site.mjs` builds it into `site/docs/`, and it goes live at
<https://vttforge.dev/docs/> with the landing page.

```bash
pnpm --filter @vttforge/docs dev     # local, with hot reload
pnpm --filter @vttforge/docs build   # static HTML
```

Every core build generates the error pages under `errors/` from the registry
in `@vttforge/core`. Edit the registry, not the pages.
