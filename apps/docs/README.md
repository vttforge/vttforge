# @vttforge/docs

The documentation site. VitePress + Pagefind.

```bash
pnpm --filter @vttforge/docs dev     # local, with hot reload
pnpm --filter @vttforge/docs build   # static HTML + search index
```

## Known Dependabot alerts

Four open alerts trace to this package. All four are transitive through
VitePress 1.6.4, which pins Vite 5.x and esbuild 0.21:

| Severity | Package | What it needs |
|---|---|---|
| High | vite | `server.fs.deny` bypass — **Windows only** |
| Medium | vite | path traversal in `.map` handling — dev server |
| Medium | launch-editor | NTLM disclosure via UNC paths — **Windows only** |
| Medium | esbuild | permissive CORS on the dev server |

Every one is a **dev-server** issue. CI runs `vitepress build`, which emits
static HTML and never starts a server, so the published site is not exposed.
The reachable case is someone running `dev` locally — on Windows, for three of
them — with a hostile page open in the same browser.

They cannot be resolved by upgrading: VitePress `latest` is 1.6.4 and it pins
Vite 5. VitePress 2 is alpha, and moving a new docs site onto an alpha to clear
dev-only advisories is the worse trade.

Revisit when VitePress 2 is stable.
