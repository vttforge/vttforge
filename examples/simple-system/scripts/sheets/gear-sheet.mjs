/**
 * GearSheet — minimal Item sheet built on @vttforge/core's `BaseItemSheet()`.
 *
 * Single PART, single TABS group, no DRAG_DROP — items rarely receive drops.
 * The point is to exercise the mirror surface of BaseActorSheet on
 * ItemSheetV2.
 */

import { BaseItemSheet } from '@vttforge/core';

const SYSTEM_ID = 'vttforge-example';

export class GearSheet extends BaseItemSheet() {
  /** @override */
  static DEFAULT_OPTIONS = foundry.utils.mergeObject(
    super.DEFAULT_OPTIONS,
    {
      id: 'vttforge-example-gear',
      classes: ['vttforge-example', 'sheet', 'item', 'gear'],
      window: {
        title: 'VTTFORGE_EXAMPLE.Sheet.Gear.title',
        icon: 'fa-solid fa-sack',
      },
      position: { width: 480, height: 420 },
    },
    { inplace: false },
  );

  static PARTS = {
    sheet: {
      template: `systems/${SYSTEM_ID}/templates/item/gear-sheet.hbs`,
    },
  };

  static TABS = {
    primary: {
      tabs: [
        {
          id: 'details',
          group: 'primary',
          label: 'VTTFORGE_EXAMPLE.Sheet.Tabs.details',
          icon: 'fa-solid fa-list',
        },
        {
          id: 'description',
          group: 'primary',
          label: 'VTTFORGE_EXAMPLE.Sheet.Tabs.description',
          icon: 'fa-solid fa-feather',
        },
      ],
      initial: 'details',
    },
  };

  /**
   * @override
   * @param {Record<string, unknown>} options
   * @returns {Promise<Record<string, unknown>>}
   */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const item = this.document;
    context.item = item;
    context.system = item.system;
    context.isEditable = this.isEditable;
    context.enrichedDescription =
      await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        item.system?.description ?? '',
        { relativeTo: item, secrets: item.isOwner },
      );
    return context;
  }
}
