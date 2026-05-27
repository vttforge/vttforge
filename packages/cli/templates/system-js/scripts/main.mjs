/**
 * {{TITLE}} — entry point.
 *
 * `registerSystem` from `@vttforge/core` replaces the ~60-line
 * `Hooks.once("init", ...)` block most systems copy-paste from each other:
 * data model registration, document class swap, initiative formula, sheet
 * registration, settings, and the `Hooks.once("ready", ...)` migration
 * gate are all wired by one call.
 */
import { registerSystem, SystemConfig, VttfError } from '@vttforge/core';
import { CharacterData } from './data/character-data.mjs';
import { GearData } from './data/gear-data.mjs';
import { migrations } from './migrations.mjs';
import { CharacterSheet } from './sheets/character-sheet.mjs';
import { GearSheet } from './sheets/gear-sheet.mjs';

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
    onAfterInit: () => {
      settings.register('showTutorial', {
        name: '{{LOCALE_PREFIX}}.Settings.showTutorial.name',
        hint: '{{LOCALE_PREFIX}}.Settings.showTutorial.hint',
        scope: 'client',
        config: true,
        type: Boolean,
        default: true,
      });

      // Register the schemaVersion setting so migrations.run() has somewhere
      // to read and write the version flag.
      migrations.register();

      const { Actors, Items } = foundry.documents.collections;
      Actors.unregisterSheet('core', foundry.applications.sheets.ActorSheetV2);
      Actors.registerSheet(SYSTEM_ID, CharacterSheet, {
        types: ['character'],
        makeDefault: true,
        label: '{{LOCALE_PREFIX}}.Sheet.Character.title',
      });
      Items.unregisterSheet('core', foundry.applications.sheets.ItemSheetV2);
      Items.registerSheet(SYSTEM_ID, GearSheet, {
        types: ['gear'],
        makeDefault: true,
        label: '{{LOCALE_PREFIX}}.Sheet.Gear.title',
      });
    },
    onReady: async () => {
      if (!game.user?.isGM) return;
      try {
        const ran = await migrations.run();
        if (ran.length > 0) {
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
