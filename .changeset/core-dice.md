---
"@vttforge/core": minor
---

Table dice helpers: `dicePool(spec)` writes a pool formula from a description (`keep`, `drop`, `successAt`, `failAt`, `explode`, `rerollAt`, `min`, `max`) with the modifiers Foundry's `Roll` parses; `stepDie(faces, steps, ladder?)` moves a die along a ladder and stays on its ends; `countSuccesses(roll, target, { failAt })` counts on any evaluated roll from the active results. Bad input is refused with VTTF-0011.
