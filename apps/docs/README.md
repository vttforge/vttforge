# @vttforge/docs

The documentation site: VitePress, with its local search. It is built into
`site/docs/` by `scripts/assemble-site.mjs` and deployed to
<https://vttforge.dev/docs/> together with the landing page.

```bash
pnpm --filter @vttforge/docs dev     # local, with hot reload
pnpm --filter @vttforge/docs build   # static HTML
```

The error pages under `errors/` are generated from the registry in
`@vttforge/core` on every core build. Edit the registry, not the pages.
