---
'@vttforge/styles': minor
---

Generate `dist/tokens.css` from W3C DTCG `tokens.json` via Style Dictionary 4. Ships the Forge token set (warm-dark + ember accent) as the default, with light overrides at `[data-theme="light"]` and an opt-in Foundry Theme V2 mapping at `[data-theme="foundry"]`.

`@vttforge/styles/tokens.css` now resolves to the generated output. The previous placeholder `tokens.css` (Foundry-only fallback) is removed.
