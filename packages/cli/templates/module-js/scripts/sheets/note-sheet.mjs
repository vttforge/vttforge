/**
 * NoteSheet — the `note` Item sheet on `BaseItemSheet()`.
 *
 * One part, no tabs, one action. The smallest sheet a module can ship.
 */
import { BaseItemSheet } from '@vttforge/core';
import { MODULE_ID } from '../constants.mjs';

export class NoteSheet extends BaseItemSheet() {
  /** @override */
  static DEFAULT_OPTIONS = foundry.utils.mergeObject(
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
   * The item this sheet is for. One place to read `this.document` from, so
   * the rest of the sheet says `this.item` and means it.
   * @returns {any}
   */
  get item() {
    return this.document;
  }

  /**
   * @override
   * @param {Record<string, unknown>} options
   * @returns {Promise<Record<string, unknown>>}
   */
  async _prepareContext(options) {
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

  /**
   * @this {NoteSheet} ApplicationV2 declares action handlers static but calls
   *   them with `this` bound to the sheet instance.
   */
  static async _onTogglePinned() {
    // biome-ignore lint/complexity/noThisInStatic: ApplicationV2 binds `this` to the sheet instance at call time
    const { item } = this;
    await item.update({ 'system.pinned': !item.system.pinned });
  }
}
