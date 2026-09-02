/**
 * GearSheet — the `gear` Item sheet on `BaseItemSheet()`.
 *
 * Single part, one tab group, no drag-drop: the smallest useful sheet.
 */
import { BaseItemSheet } from '@vttforge/core';
import type { GearData } from '../data/gear-data.js';

const SYSTEM_ID = '{{ID}}';

/** What this sheet reads off its item. See `CharacterSheet` for the pattern. */
interface GearItem {
  readonly name: string;
  readonly img: string;
  readonly isOwner: boolean;
  readonly system: GearData;
}

export class GearSheet extends BaseItemSheet() {
  static override DEFAULT_OPTIONS = foundry.utils.mergeObject(
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
    sheet: { template: `systems/${SYSTEM_ID}/templates/item/gear-sheet.hbs` },
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

  get item(): GearItem {
    return this.document as GearItem;
  }

  override async _prepareContext(options: unknown): Promise<Record<string, unknown>> {
    const context = await super._prepareContext(options);
    const { item } = this;
    context.item = item;
    context.system = item.system;
    context.isEditable = this.isEditable;
    context.enrichedDescription = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      item.system.description,
      { relativeTo: item, secrets: item.isOwner },
    );
    return context;
  }
}
