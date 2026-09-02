/**
 * vttforge-example — entry point.
 *
 * One-call boot via @vttforge/core's `registerSystem`. Replaces what would
 * otherwise be a ~60-line Hooks.once("init", ...) block plus the
 * Hooks.once("ready", ...) for migrations.
 *
 * This file is the smoke test for everything @vttforge/core ships in v0.1:
 *
 * - PR 5: typed data models via `BaseTypeDataModel()` + `fields()`
 *   (see scripts/data/character-data.mjs and gear-data.mjs)
 * - PR 6: declarative sheet boilerplate via `BaseActorSheet()` /
 *   `BaseItemSheet()` (TABS + DRAG_DROP + typed drop dispatch)
 *   (see scripts/sheets/character-sheet.mjs and gear-sheet.mjs)
 * - PR 7: declarative migrations via `createMigrationRunner()`
 *   (see scripts/migrations.mjs)
 * - PR 8: error catalogue via VttfError + the dist/errors-manifest.json
 *   shipped with @vttforge/core
 */

import { registerSystem, SystemConfig, VttfError } from '@vttforge/core';
import { CharacterData } from './data/character-data.mjs';
import { GearData } from './data/gear-data.mjs';
import { migrations } from './migrations.mjs';
import { CharacterSheet } from './sheets/character-sheet.mjs';
import { GearSheet } from './sheets/gear-sheet.mjs';

const SYSTEM_ID = 'vttforge-example';

const settings = new SystemConfig(SYSTEM_ID);

try {
  registerSystem({
    id: SYSTEM_ID,
    actorDataModels: { character: CharacterData },
    itemDataModels: { gear: GearData },
    combat: {
      initiative: { formula: '1d20 + @abilities.dex.mod', decimals: 2 },
    },
    onBeforeInit: () => {
      // The core sheets go first, so ours can take the default. This runs
      // before the `sheets` below are registered.
      const { Actors, Items } = foundry.documents.collections;
      Actors.unregisterSheet('core', foundry.applications.sheets.ActorSheetV2);
      Items.unregisterSheet('core', foundry.applications.sheets.ItemSheetV2);
    },

    // Declared here rather than with Actors.registerSheet, so the key Foundry
    // saves on each document is `vttforge-example.character` — written down,
    // not derived from a class name a bundler is free to rename.
    sheets: [
      {
        id: 'character',
        document: 'Actor',
        sheet: CharacterSheet,
        types: ['character'],
        makeDefault: true,
        label: 'VTTFORGE_EXAMPLE.Sheet.Character.title',
      },
      {
        id: 'gear',
        document: 'Item',
        sheet: GearSheet,
        types: ['gear'],
        makeDefault: true,
        label: 'VTTFORGE_EXAMPLE.Sheet.Gear.title',
      },
    ],

    onAfterInit: () => {
      // Surface a single user-facing setting so the SystemConfig wrapper is
      // exercised end-to-end alongside the migration setting.
      settings.register('showTutorial', {
        name: 'VTTFORGE_EXAMPLE.Settings.showTutorial.name',
        hint: 'VTTFORGE_EXAMPLE.Settings.showTutorial.hint',
        scope: 'client',
        config: true,
        type: Boolean,
        default: true,
      });

      // Register the schemaVersion setting so migrations.run() has somewhere
      // to read/write the version.
      migrations.register();
    },
    onReady: async () => {
      if (!game.user?.isGM) return;
      try {
        const ran = await migrations.run();
        if (ran.length > 0) {
          // biome-ignore lint/suspicious/noConsole: console.info is the only Foundry-portable info logger; createMigrationRunner's logger also notifies the UI
          console.info(`[${SYSTEM_ID}] applied migrations:`, ran.join(', '));
        }
      } catch (err) {
        if (err instanceof VttfError) {
          ui.notifications?.error(`[${err.code}] ${err.message} — see ${err.docsUrl}`, {
            permanent: true,
          });
        }
        throw err;
      }
    },
  });
} catch (err) {
  if (err instanceof VttfError) {
    console.error(`[${err.code}] ${err.message} — see ${err.docsUrl}`);
  }
  throw err;
}
