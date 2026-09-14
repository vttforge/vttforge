---
'@vttforge/cli': patch
'@vttforge/core': patch
'@vttforge/styles': patch
'@vttforge/types': patch
'@vttforge/vite-plugin': patch
'create-vttforge': patch
---

READMEs led with `pnpm add`/`pnpm create` even though VTTForge's own
toolchain has run on Bun since the pnpm-to-bun migration. Every install
and scaffold example now leads with `bun`; the CLI's multi-package-manager
detection stays real and unchanged, `pnpm`/`npm`/`yarn` still work and are
listed as alternatives where they were already shown that way.
