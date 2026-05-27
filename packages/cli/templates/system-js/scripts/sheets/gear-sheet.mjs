/**
 * GearSheet — minimal Item sheet built on `BaseItemSheet()` from
 * `@vttforge/core`. Single PART, single TABS group, no DRAG_DROP — exercises
 * the mirror surface of BaseActorSheet on ItemSheetV2.
 */
import { BaseItemSheet } from '@vttforge/core';

const SYSTEM_ID = '{{ID}}';

export class GearSheet extends BaseItemSheet() {
  static DEFAULT_OPTIONS = foundry.utils.mergeObject(
    super.DEFAULT_OPTIONS,
    {
      id: '{{ID}}-gear',
      classes: ['{{ID}}', 'sheet', 'item', 'gear'],
      window: {
        title: '{{LOCALE_PREFIX}}.Sheet.Gear.title',
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
          label: '{{LOCALE_PREFIX}}.Sheet.Tabs.details',
          icon: 'fa-solid fa-list',
        },
        {
          id: 'description',
          group: 'primary',
          label: '{{LOCALE_PREFIX}}.Sheet.Tabs.description',
          icon: 'fa-solid fa-feather',
        },
      ],
      initial: 'details',
    },
  };

  /** @override */
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
