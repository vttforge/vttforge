/**
 * CharacterSheet — tabbed character sheet built on `BaseActorSheet()` from
 * `@vttforge/core`. Demonstrates the full boilerplate-elimination surface:
 *
 * - `static TABS` — `context.tabs.<group>` auto-populated by BaseActorSheet
 *   (no manual `_prepareTabs` call).
 * - `static DRAG_DROP` — wires `foundry.applications.ux.DragDrop` on first
 *   render with `isEditable`-gated permissions.
 * - Typed `onDropItem(item, event)` — pre-resolves UUIDs, rejects
 *   non-`gear` items with a notification, lets `gear` flow through to
 *   Foundry's default `_onDropItem` by returning `undefined`.
 */
import { BaseActorSheet } from '@vttforge/core';

const SYSTEM_ID = '{{ID}}';

export class CharacterSheet extends BaseActorSheet() {
  static DEFAULT_OPTIONS = foundry.utils.mergeObject(
    super.DEFAULT_OPTIONS,
    {
      id: '{{ID}}-character',
      classes: ['{{ID}}', 'sheet', 'actor', 'character'],
      window: {
        title: '{{LOCALE_PREFIX}}.Sheet.Character.title',
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
          label: '{{LOCALE_PREFIX}}.Sheet.Tabs.abilities',
          icon: 'fa-solid fa-dumbbell',
        },
        {
          id: 'inventory',
          group: 'primary',
          label: '{{LOCALE_PREFIX}}.Sheet.Tabs.inventory',
          icon: 'fa-solid fa-sack',
        },
        {
          id: 'spells',
          group: 'primary',
          label: '{{LOCALE_PREFIX}}.Sheet.Tabs.spells',
          icon: 'fa-solid fa-wand-magic-sparkles',
        },
        {
          id: 'biography',
          group: 'primary',
          label: '{{LOCALE_PREFIX}}.Sheet.Tabs.biography',
          icon: 'fa-solid fa-feather',
        },
      ],
      initial: 'abilities',
    },
  };

  static DRAG_DROP = [
    {
      dragSelector: '.sh-item[draggable=true]',
      dropSelector: '.sh-body',
    },
  ];

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = this.document;
    const system = actor.system;
    const abilityLabels = {
      str: '{{LOCALE_PREFIX}}.Ability.str',
      dex: '{{LOCALE_PREFIX}}.Ability.dex',
      con: '{{LOCALE_PREFIX}}.Ability.con',
      int: '{{LOCALE_PREFIX}}.Ability.int',
      wis: '{{LOCALE_PREFIX}}.Ability.wis',
      cha: '{{LOCALE_PREFIX}}.Ability.cha',
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
    context.gear = actor.items
      .filter((item) => item.type === 'gear')
      .map((item) => ({
        id: item.id,
        name: item.name,
        img: item.img,
        kind: item.system?.kind ?? 'stowed',
        quantity: item.system?.quantity ?? 1,
        weight: item.system?.weight ?? 0,
        description: item.system?.description ?? '',
      }));
    context.enrichedBiography = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      system.biography ?? '',
      { relativeTo: actor, secrets: actor.isOwner },
    );
    return context;
  }

  /** Reject non-gear drops with a notification; let gear fall through. */
  async onDropItem(item, _event) {
    if (item?.type !== 'gear') {
      ui.notifications?.warn(
        game.i18n.format('{{LOCALE_PREFIX}}.Sheet.Drop.rejected', { type: item?.type ?? 'unknown' }),
      );
      return false;
    }
    return undefined;
  }

  static async _onRollAbility(_event, target) {
    const key = target?.dataset?.ability;
    if (!key) return;
    const actor = this.document;
    const mod = actor.system.abilities?.[key]?.mod ?? 0;
    const roll = new Roll(`1d20 + ${mod}`, actor.getRollData());
    await roll.evaluate();
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: game.i18n.format('{{LOCALE_PREFIX}}.Sheet.Roll.flavor', {
        ability: game.i18n.localize(`{{LOCALE_PREFIX}}.Ability.${key}`),
      }),
    });
  }

  static async _onCreateGear(_event, _target) {
    const cls = CONFIG.Item.documentClass;
    const parent = this.document;
    await cls.create(
      { name: game.i18n.localize('{{LOCALE_PREFIX}}.Sheet.NewGearName'), type: 'gear' },
      { parent, renderSheet: true },
    );
  }

  static async _onDeleteItem(_event, target) {
    const row = target?.closest('[data-item-id]');
    const id = row?.dataset?.itemId;
    if (!id) return;
    const item = this.document.items.get(id);
    await item?.delete();
  }
}
