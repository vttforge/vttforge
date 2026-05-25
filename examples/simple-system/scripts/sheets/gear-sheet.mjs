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
      actions: {
        tab: GearSheet._onTab,
      },
    },
    { inplace: false },
  );

  /** Default tab navigation handler — ApplicationV2 doesn't ship one. */
  static _onTab(_event, target) {
    // biome-ignore lint/complexity/noThisInStatic: ApplicationV2 binds `this` to the sheet instance at call time
    const sheet = this;
    const group = target.dataset.group;
    const tab = target.dataset.tab;
    if (!group || !tab) return;
    sheet.tabGroups[group] = tab;
    const root = sheet.element;
    for (const link of root.querySelectorAll(`nav[data-group="${group}"] [data-tab]`)) {
      link.classList.toggle('active', link.dataset.tab === tab);
    }
    for (const section of root.querySelectorAll(`section.tab[data-group="${group}"]`)) {
      section.classList.toggle('active', section.dataset.tab === tab);
    }
  }

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

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    // Same single-group tabs unwrap as CharacterSheet — see comment there.
    if (context.tabs?.primary && Object.keys(context.tabs).length === 1) {
      context.tabs = context.tabs.primary;
    }
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
