/**
 * VTTForge Example Module — entry point.
 *
 * One `registerModule` call replaces the `Hooks.once("init", ...)` block most
 * modules copy from each other: the sub-type, its sheet, the enricher, the
 * settings, and the public API.
 */
import { registerModule, SystemConfig, VttfError } from '@vttforge/core';
import { MODULE_ID, NOTE_TYPE } from './constants.mjs';
import { NoteData } from './data/note-data.mjs';
import { noteEnricher } from './enricher.mjs';
import { NoteSheet } from './sheets/note-sheet.mjs';

const settings = new SystemConfig(MODULE_ID);

/** What `game.modules.get("vttforge-example-module").api` offers other modules and macros. */
const api = {
  /** The prefixed type key, for `item.type === api.noteType` checks. */
  noteType: NOTE_TYPE,
  /**
   * @param {string} name
   * @param {string} [body]
   */
  createNote(name, body = '') {
    return CONFIG.Item.documentClass.create(
      { name, type: NOTE_TYPE, system: { body } },
      { renderSheet: true },
    );
  },
};

try {
  registerModule({
    id: MODULE_ID,

    // Registered as `vttforge-example-module.note` — the prefix is added for you, and the
    // manifest declares the same key under `documentTypes.Item`.
    itemDataModels: { note: NoteData },

    // Declared here rather than with `Items.registerSheet`. Foundry keys a
    // sheet by `${scope}.${class name}` and saves that key on every document
    // using it; a bundler renames classes between builds, and the saved key
    // then names a sheet that no longer exists. The `id` is written down, so
    // the key does not move. Pick it once and keep it.
    sheets: [
      {
        id: 'note',
        document: 'Item',
        sheet: NoteSheet,
        types: [NOTE_TYPE],
        makeDefault: true,
        label: 'VTTFORGE_EXAMPLE_MODULE.Sheet.Note.title',
      },
    ],

    enrichers: [noteEnricher],

    // Runs first inside `init` — the usual home for the module API, so it is
    // there before anything that might hook `init` after us asks for it.
    onBeforeInit: () => {
      const handle = game.modules.get(MODULE_ID);
      if (handle) handle.api = api;
    },

    onAfterInit: () => {
      settings.register('showWelcome', {
        name: 'VTTFORGE_EXAMPLE_MODULE.Settings.showWelcome.name',
        hint: 'VTTFORGE_EXAMPLE_MODULE.Settings.showWelcome.hint',
        scope: 'client',
        config: true,
        type: Boolean,
        default: true,
      });
    },

    onReady: () => {
      if (settings.get('showWelcome')) {
        ui.notifications?.info(game.i18n.localize('VTTFORGE_EXAMPLE_MODULE.Welcome'));
      }
    },
  });
} catch (err) {
  if (err instanceof VttfError) {
    console.error(`[${err.code}] ${err.message} — see ${err.docsUrl}`);
  }
  throw err;
}
