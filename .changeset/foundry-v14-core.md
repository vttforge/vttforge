---
'@vttforge/core': minor
---

Target Foundry v14.

- `registerSystem` no longer takes `activeEffect.legacyTransferral`. v14 removed the flag; Item effects with `transfer: true` apply to the Actor in place.
- `statusEffects` on `registerSystem` and `registerModule` adds each entry to `CONFIG.statusEffects` by its `id` instead of assigning or pushing an array. v14 keys the collection by id, and a whole-array assignment empties it first. An entry without a string `id` throws the new `VTTF-0008`.
- The `ActiveEffectConfig` type is gone; `StatusEffectConfig` is new.
