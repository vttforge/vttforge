---
"@vttforge/types": minor
"@vttforge/core": minor
"@vttforge/testing": minor
---

Type the Foundry globals: `game`, `ui`, `CONFIG`, `CONST` and `foundry.utils`.

**What breaks.** `GameApi` is now `Game`, and `ActorConfig`, `ItemConfig` and
`ConfigCollection` are now the one `DocumentConfig`. The old names still work
and carry an `@deprecated` tag naming the replacement. `CONFIG.Combat` is a
full `CombatConfig`, so code that assigned a bare `{ initiative }` object to it
no longer compiles; assign to `CONFIG.Combat.initiative` instead.

`@vttforge/types` now describes:

- `Game`, with the settings API, `i18n`, `time`, the world collections, the
  compendium packs and the module handles.
- `UiApi`, including `ui.notifications` and the sidebar.
- `FoundryConfig`, with every document entry plus the ones a package writes in
  `init`: `statusEffects`, `TextEditor.enrichers`, `Dice`, `queries`.
- `FoundryConstants`, with the real keys on the enumerations a package reads.
  `ACTIVE_EFFECT_CHANGE_PHASES`, `ACTIVE_EFFECT_EXPIRY_EVENTS` and
  `ACTIVE_EFFECT_DURATION_UNITS` are arrays, not records.
- `FoundryUtils`: every member of `foundry.utils`, the geometry helpers
  included. The bare globals these replaced are gone in v14.

Three options on `registerSystem` stopped being `unknown`:
`actorDocumentClass`, `itemDocumentClass` and the two data model maps now take
a class.

`@vttforge/testing` gains `createMockConfig()`. A live Foundry has every
`CONFIG` entry, so the type asks for all of them; a test that cares about one
gets the rest from the factory.

```ts
import { createMockConfig } from "@vttforge/testing/vitest";

const CONFIG = createMockConfig({ statusEffects: { prone: { id: "prone" } } });
CONFIG.Combat.initiative = { formula: "1d20" };
```
