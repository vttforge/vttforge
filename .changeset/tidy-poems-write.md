---
'@vttforge/core': patch
'@vttforge/styles': patch
'@vttforge/types': patch
'@vttforge/dev-module': patch
'@vttforge/testing': patch
---

Stop requiring Node 26 to install a browser package.

Every package declared `engines.node: ">=26.0.0"`. Four of them — `core`, `styles`, `types` and `dev-module` — compile to ES2022 and run in the browser inside Foundry. They never touch Node, and the floor did nothing except stop anyone on Node 22 LTS from installing the SDK at all.

Those four declare no engine now. `@vttforge/testing` drops to `>=22` — its Quench half runs in the browser too. `@vttforge/cli` and `@vttforge/vite-plugin` keep `>=26`, which is what they actually build against.
