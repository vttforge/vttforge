---
"@vttforge/cli": patch
"@vttforge/core": patch
"@vttforge/vite-plugin": patch
"@vttforge/types": patch
---

Read the exported `VTTFORGE_*_VERSION` constants from `package.json` at build time. They were hardcoded and had fallen behind — `vttforge --version` printed `0.1.0` on the 0.5 line.
