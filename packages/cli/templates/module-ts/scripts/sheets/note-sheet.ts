/**
 * NoteSheet — the `note` Item sheet on `BaseItemSheet()`.
 *
 * One part, no tabs, one action. The smallest sheet a module can ship.
 */
import { BaseItemSheet, type ItemLike } from '@vttforge/core';
import { MODULE_ID } from '../constants.js';
import type { NoteData } from '../data/note-data.js';

/**
 * The item this sheet is for.
 *
 * `ItemLike` is the document surface `@vttforge/core` ships; the type
 * argument is your own schema, so `item.system.body` is typed.
 */
type NoteItem = ItemLike<NoteData>;

export class NoteSheet extends BaseItemSheet<NoteItem>() {
  static override DEFAULT_OPTIONS = foundry.utils.mergeObject(
    super.DEFAULT_OPTIONS,
    {
      id: '{{ID}}-note',
      classes: ['{{ID}}', 'sheet', 'item', 'note'],
      window: {
        title: '{{LOCALE_PREFIX}}.Sheet.Note.title',
        icon: 'fa-solid fa-note-sticky',
      },
      position: { width: 480, height: 480 },
      actions: {
        togglePinned: NoteSheet._onTogglePinned,
      },
    },
    { inplace: false },
  );

  static PARTS = {
    sheet: { template: `modules/${MODULE_ID}/templates/item/note-sheet.hbs` },
  };

  /**
   * The item this sheet is for.
   *
   * Typed by the argument to `BaseItemSheet`.
   */
  get item(): NoteItem {
    return this.document;
  }

  override async _prepareContext(options: unknown): Promise<Record<string, unknown>> {
    const context = await super._prepareContext(options);
    const { item } = this;
    context.item = item;
    context.system = item.system;
    context.isEditable = this.isEditable;
    context.reference = `@Note[${item.id}]`;
    context.enrichedBody = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      item.system.body,
      { relativeTo: item, secrets: item.isOwner },
    );
    return context;
  }

  // ApplicationV2 declares action handlers static and calls them with `this`
  // bound to the sheet instance. `this: NoteSheet` says so to TypeScript.
  static async _onTogglePinned(this: NoteSheet): Promise<void> {
    await this.item.update({ 'system.pinned': !this.item.system.pinned });
  }
}
