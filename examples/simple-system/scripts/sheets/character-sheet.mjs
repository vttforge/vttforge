/**
 * CharacterSheet — tabbed character sheet built on @vttforge/core's
 * `BaseActorSheet()`.
 *
 * Demonstrates every PR 6 surface:
 *
 * - `static TABS` for abilities / inventory / biography — `context.tabs.primary`
 *   is auto-populated by BaseActorSheet's `_prepareContext` (no `_prepareTabs`
 *   call in user code).
 * - `static DRAG_DROP` enables `data-item-id` rows in the inventory to be
 *   dragged out, and accepts incoming drops.
 * - Typed `onDropItem(item, event)` — pre-resolves `fromUuid`, rejects
 *   non-gear items with a notification, lets gear flow through to Foundry's
 *   default create-embedded behaviour by returning undefined.
 * - `editImage` already ships on DocumentSheetV2; the template binds
 *   `<img data-edit="img">` and Foundry's built-in action handles it.
 */

import { BaseActorSheet } from '@vttforge/core';

const SYSTEM_ID = 'vttforge-example';

export class CharacterSheet extends BaseActorSheet() {
  static DEFAULT_OPTIONS = foundry.utils.mergeObject(
    super.DEFAULT_OPTIONS,
    {
      id: 'vttforge-example-character',
      classes: ['vttforge-example', 'sheet', 'actor', 'character'],
      window: {
        title: 'VTTFORGE_EXAMPLE.Sheet.Character.title',
        icon: 'fa-solid fa-user',
      },
      position: { width: 640, height: 700 },
      actions: {
        rollAbility: CharacterSheet._onRollAbility,
        createGear: CharacterSheet._onCreateGear,
        deleteItem: CharacterSheet._onDeleteItem,
      },
    },
    { inplace: false },
  );

  static PARTS = {
    sheet: {
      template: `systems/${SYSTEM_ID}/templates/actor/character-sheet.hbs`,
    },
  };

  static TABS = {
    primary: {
      tabs: [
        {
          id: 'abilities',
          group: 'primary',
          label: 'VTTFORGE_EXAMPLE.Sheet.Tabs.abilities',
          icon: 'fa-solid fa-dumbbell',
        },
        {
          id: 'inventory',
          group: 'primary',
          label: 'VTTFORGE_EXAMPLE.Sheet.Tabs.inventory',
          icon: 'fa-solid fa-sack',
        },
        {
          id: 'biography',
          group: 'primary',
          label: 'VTTFORGE_EXAMPLE.Sheet.Tabs.biography',
          icon: 'fa-solid fa-feather',
        },
      ],
      initial: 'abilities',
    },
  };

  static DRAG_DROP = [
    {
      dragSelector: '.item[draggable=true]',
      dropSelector: '.sheet-body',
    },
  ];

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = this.document;
    const system = actor.system;
    const abilityLabels = {
      str: 'VTTFORGE_EXAMPLE.Ability.str',
      dex: 'VTTFORGE_EXAMPLE.Ability.dex',
      con: 'VTTFORGE_EXAMPLE.Ability.con',
      int: 'VTTFORGE_EXAMPLE.Ability.int',
      wis: 'VTTFORGE_EXAMPLE.Ability.wis',
      cha: 'VTTFORGE_EXAMPLE.Ability.cha',
    };
    context.actor = actor;
    context.system = system;
    context.isEditable = this.isEditable;
    context.abilities = Object.entries(system.abilities ?? {}).map(([key, data]) => ({
      key,
      label: game.i18n.localize(abilityLabels[key] ?? key),
      value: data?.value ?? data,
      mod: data?.mod ?? 0,
    }));
    context.gear = actor.items.filter((item) => item.type === 'gear');
    context.enrichedBiography = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      system.biography ?? '',
      { relativeTo: actor, secrets: actor.isOwner },
    );
    return context;
  }

  /** Reject non-gear drops with a notification; let gear fall through to Foundry. */
  async onDropItem(item, _event) {
    if (item?.type !== 'gear') {
      ui.notifications?.warn(
        game.i18n.format('VTTFORGE_EXAMPLE.Sheet.Drop.rejected', { type: item?.type ?? 'unknown' }),
      );
      return false;
    }
    return undefined;
  }

  static async _onRollAbility(_event, target) {
    const key = target?.dataset?.ability;
    if (!key) return;
    // biome-ignore lint/complexity/noThisInStatic: ApplicationV2 action handlers are declared static but invoked with `this` bound to the sheet instance — see Foundry module guidance references/application-v2.md §"Actions System"
    const actor = this.document;
    const mod = actor.system.abilities?.[key]?.mod ?? 0;
    const roll = new Roll(`1d20 + ${mod}`, actor.getRollData());
    await roll.evaluate();
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: game.i18n.format('VTTFORGE_EXAMPLE.Sheet.Roll.flavor', {
        ability: game.i18n.localize(`VTTFORGE_EXAMPLE.Ability.${key}`),
      }),
    });
  }

  static async _onCreateGear(_event, _target) {
    const cls = CONFIG.Item.documentClass;
    // biome-ignore lint/complexity/noThisInStatic: ApplicationV2 binds `this` to the sheet instance at call time
    const parent = this.document;
    await cls.create(
      { name: game.i18n.localize('VTTFORGE_EXAMPLE.Sheet.NewGearName'), type: 'gear' },
      { parent, renderSheet: true },
    );
  }

  static async _onDeleteItem(_event, target) {
    const row = target?.closest('[data-item-id]');
    const id = row?.dataset?.itemId;
    if (!id) return;
    // biome-ignore lint/complexity/noThisInStatic: ApplicationV2 binds `this` to the sheet instance at call time
    const item = this.document.items.get(id);
    await item?.delete();
  }
}
