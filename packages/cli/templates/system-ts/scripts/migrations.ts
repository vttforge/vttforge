/**
 * Migration registry for {{TITLE}}.
 *
 * Each entry is idempotent — safe to re-run if a prior pass failed
 * mid-sequence. `createMigrationRunner` reads the version flag declared in
 * `system.json` (`flags.{{ID}}.needsMigrationVersion`), runs every
 * migration whose version is newer than what's stored in the world's
 * `schemaVersion` setting, and persists the new high-water mark on success.
 */
import { createMigrationRunner } from '@vttforge/core';

const SYSTEM_ID = '{{ID}}';

/**
 * v0.1.0 — first real schema. Add real migration logic here as soon as the
 * first breaking schema change ships. Until then, this is a no-op example
 * that proves the runner end-to-end.
 */
async function migrateToV0_1_0(): Promise<void> {
  // Iterate world documents and rewrite legacy fields here. Example:
  //
  //   const actors = game.actors?.filter((a) => a.type === 'character') ?? [];
  //   for (const actor of actors) {
  //     const legacy = actor.system?.bio;
  //     if (typeof legacy !== 'string') continue;
  //     await actor.update({
  //       'system.biography': legacy,
  //       '-=system.bio': null,
  //     });
  //   }
}

export const migrations = createMigrationRunner({
  systemId: SYSTEM_ID,
  compatibleVersion: '0.0.0',
  migrations: [
    {
      version: '0.1.0',
      description: 'initial schema — placeholder for first breaking change',
      fn: migrateToV0_1_0,
    },
  ],
});
