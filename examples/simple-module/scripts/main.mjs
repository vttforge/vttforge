/**
 * VTTForge Example Module — entry point.
 *
 * One `registerModule` call replaces the `Hooks.once("init", ...)` block most
 * modules copy from each other: the sub-type, its sheet, the enricher, the
 * settings, and the public API.
 */
import {
  convertSubTypes,
  inject,
  PackageConfig,
  registerModule,
  registerSocket,
  subTypeDocuments,
  VttfError,
} from '@vttforge/core';
import { MODULE_ID, NOTE_TYPE } from './constants.mjs';
import { NoteData } from './data/note-data.mjs';
import { noteEnricher } from './enricher.mjs';
import { NoteSheet } from './sheets/note-sheet.mjs';

const settings = new PackageConfig(MODULE_ID);

/**
 * Set by `registerSocket` at `setup`, used by the API below.
 *
 * @type {import('@vttforge/core').PackageSocket}
 */
let socket;

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

  /**
   * Show a note to the table. One-way: nothing comes back.
   *
   * @param {string} text
   * @param {string[]} [userIds] who sees it. Left out, everyone.
   */
  announce(text, userIds) {
    return socket.emit('announce', { text }, userIds ? { to: userIds } : undefined);
  },

  /**
   * Ask the Gamemaster's client to file a note in the world.
   *
   * A player cannot create a world Item, so this is the only way for one to
   * end up with a note. The answer is the new item's id.
   *
   * @param {string} name
   * @param {string} [body]
   * @returns {Promise<string>}
   */
  requestNote(name, body = '') {
    return socket.askGm('createNote', { name, body });
  },

  /** How many notes a user would strand by removing this module. */
  countNotes() {
    return subTypeDocuments({ id: MODULE_ID, document: 'Item', type: 'note' }).length;
  },

  /**
   * Turn every note into a plain Item, so nothing is lost when this module
   * goes away. Run it before switching the module off.
   *
   * @returns {Promise<import('@vttforge/core').ConvertedSubTypes>}
   */
  convertNotes() {
    return convertSubTypes({
      id: MODULE_ID,
      document: 'Item',
      type: 'note',
      // `base` belongs to no package, so it survives anything else being
      // uninstalled too.
      to: 'base',
    });
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

    // Published on `game.modules.get(id).api` during `init`, before any
    // CONFIG mutation. Doing it later means anything that looked during its
    // own `init` found nothing and had no way to know why.
    api,

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

    // `setup` rather than `init`: the handlers are registered once, and by
    // then every package has finished its own `init`.
    onSetup: () => {
      socket = registerSocket({
        id: MODULE_ID,
        kind: 'module',

        messages: {
          // Default `from: 'gm'`. A player sending this is ignored, and the
          // check reads the sender id the server supplied, not the payload.
          announce: {
            run: ({ text }, context) => {
              ui.notifications?.info(`${context.user?.name ?? 'Someone'}: ${text}`);
              // A marker the end-to-end run reads to prove the message
              // arrived on this client.
              Object.assign(globalThis, { vttforgeExampleAnnounced: text });
            },
          },
        },

        requests: {
          // Runs on the Gamemaster's client, whoever asked.
          createNote: async ({ name, body }, context) => {
            const item = await CONFIG.Item.documentClass.create({
              name,
              type: NOTE_TYPE,
              system: { body: `${body} (asked for by ${context.user?.name ?? 'nobody'})` },
            });
            return item.id;
          },
        },
      });

      // A button in the Items sidebar, put back after every re-render without
      // ever ending up with two of them.
      inject({
        id: MODULE_ID,
        name: 'newNote',
        hook: 'renderItemDirectory',
        into: '.directory-header',
        position: 'append',
        when: () => game.user?.isGM === true,
        render: () => {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'vttforge-example-new-note';
          button.textContent = game.i18n.localize('VTTFORGE_EXAMPLE_MODULE.NewNote');
          button.addEventListener('click', () => api.createNote('New note'));
          return button;
        },
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
