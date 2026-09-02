/**
 * {{TITLE}} — entry point.
 *
 * One `registerSystem` call replaces the `Hooks.once("init", ...)` block most
 * systems copy from each other: data models, initiative, sheets, settings,
 * and the `ready`-time migration gate.
 */
import './foundry-globals.js';
import { registerSystem, SystemConfig, VttfError } from '@vttforge/core';
import { CharacterData } from './data/character-data.js';
import { GearData } from './data/gear-data.js';
import { migrations } from './migrations.js';
import { CharacterSheet } from './sheets/character-sheet.js';
import { GearSheet } from './sheets/gear-sheet.js';

const SYSTEM_ID = '{{ID}}';

const settings = new SystemConfig(SYSTEM_ID);

try {
  registerSystem({
    id: SYSTEM_ID,
    actorDataModels: { character: CharacterData },
    itemDataModels: { gear: GearData },
    combat: {
      initiative: { formula: '1d20 + @abilities.dex.mod', decimals: 2 },
    },

    // The core sheets have to go before ours can be the default. This runs
    // before the `sheets` below are registered.
    onBeforeInit: () => {
      const { Actors, Items } = foundry.documents.collections;
      Actors.unregisterSheet('core', foundry.applications.sheets.ActorSheetV2);
      Items.unregisterSheet('core', foundry.applications.sheets.ItemSheetV2);
    },

    // Declared here rather than with `Actors.registerSheet`. Foundry keys a
    // sheet by `${scope}.${class name}` and saves that key on every document
    // using it; a bundler renames classes between builds, and the saved key
    // then names a sheet that no longer exists. The `id` is written down, so
    // the key does not move. Pick it once and keep it.
    sheets: [
      {
        id: 'character',
        document: 'Actor',
        sheet: CharacterSheet,
        types: ['character'],
        makeDefault: true,
        label: '{{LOCALE_PREFIX}}.Sheet.Character.title',
      },
      {
        id: 'gear',
        document: 'Item',
        sheet: GearSheet,
        types: ['gear'],
        makeDefault: true,
        label: '{{LOCALE_PREFIX}}.Sheet.Gear.title',
      },
    ],

    onAfterInit: () => {
      settings.register('showTutorial', {
        name: '{{LOCALE_PREFIX}}.Settings.showTutorial.name',
        hint: '{{LOCALE_PREFIX}}.Settings.showTutorial.hint',
        scope: 'client',
        config: true,
        type: Boolean,
        default: true,
      });

      // The schemaVersion setting `migrations.run()` reads and writes.
      migrations.register();
    },

    onReady: async () => {
      if (!game.user?.isGM) return;
      try {
        const ran = await migrations.run();
        if (ran.length > 0) {
          // biome-ignore lint/suspicious/noConsole: console.info is the only Foundry-portable info logger
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
    // biome-ignore lint/suspicious/noConsole: bootstrap-time failures must surface
    console.error(`[${err.code}] ${err.message} — see ${err.docsUrl}`);
  }
  throw err;
}
