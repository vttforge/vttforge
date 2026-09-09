---
'@vttforge/cli': minor
---

What the first run over seven v13 projects taught the audit and the migrate command.

- `audit` gains `VTTF-AUDIT-017` (the jQuery `renderChatMessage` hook, removed in v15) and `VTTF-AUDIT-018` (a class on an Application v1 base, removed in v16).
- `VTTF-AUDIT-007` resolves the token attributes against `template.json` too, so a system that still declares its types there is not flagged for a bar that works.
- Both commands skip minified bundles (`*.min.js`): a vendored library is not the author's to fix.
- `migrate` rewrites `rollMode: <expression>` to `messageMode: Roll._mapLegacyRollMode(<expression>)` instead of asking, handles a template-literal deletion key such as `` [`flags.${id}.-=old`] ``, and notes every `renderChatMessage` handler.
