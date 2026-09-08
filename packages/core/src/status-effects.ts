/**
 * Status effects, added to `CONFIG.statusEffects` one id at a time.
 *
 * Foundry v14 indexes `CONFIG.statusEffects` by id, and assigning a whole
 * array to it empties the collection first, which throws away every condition
 * another package added earlier in `init`. So neither `registerSystem` nor
 * `registerModule` assigns: both add by id, and an entry with the same id as
 * an existing one replaces it, which is how a system swaps a core condition
 * for its own.
 */

import { VttfError } from './errors/registry.js';
import type { FoundryConfig, StatusEffectConfig } from './foundry-globals.js';

export function addStatusEffects(
  packageId: string,
  effects: readonly StatusEffectConfig[],
  CONFIG: FoundryConfig,
): void {
  CONFIG.statusEffects ??= {};
  const target = CONFIG.statusEffects;
  for (const effect of effects) {
    if (typeof effect.id !== 'string' || effect.id.length === 0) {
      throw new VttfError(
        'VTTF-0008',
        `Package "${packageId}" registered a status effect without an id: ${JSON.stringify(effect)}`,
      );
    }
    target[effect.id] = effect;
  }
}
