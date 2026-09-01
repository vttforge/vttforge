/**
 * Migration registry for vttforge-example — exercises @vttforge/core's
 * `createMigrationRunner`.
 *
 * Versions line up with `system.json`'s
 * `flags.vttforge-example.needsMigrationVersion`. Each migration is
 * idempotent — safe to re-run if a prior pass failed mid-sequence.
 */

import { createMigrationRunner } from '@vttforge/core';

const SYSTEM_ID = 'vttforge-example';

/**
 * v0.1.0 — first real schema. Renames any pre-v0.1 `bio` field on Character
 * actors to `biography` so worlds that briefly ran against an earlier draft
 * survive the rename.
 */
async function migrateToV0_1_0() {
  const actors = game.actors?.filter(/** @param {any} a */ (a) => a.type === 'character') ?? [];
  for (const actor of actors) {
    const legacy = actor.system?.bio;
    if (typeof legacy !== 'string') continue;
    await actor.update({
      'system.biography': legacy,
      '-=system.bio': null,
    });
  }
}

export const migrations = createMigrationRunner({
  systemId: SYSTEM_ID,
  compatibleVersion: '0.0.0',
  migrations: [
    {
      version: '0.1.0',
      description: 'rename character.bio → character.biography',
      fn: migrateToV0_1_0,
    },
  ],
});
