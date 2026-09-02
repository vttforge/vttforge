/**
 * CharacterSheet — tabbed character sheet on `BaseActorSheet()`.
 *
 * - `static TABS` — `context.tabs.<group>` is filled in for you.
 * - `static DRAG_DROP` — drag-drop wired on render, gated on `isEditable`.
 * - `onDropItem(item, event)` — the item arrives resolved, not as a UUID.
 *   Return `false` to refuse, `undefined` to hand the drop back to Foundry.
 */
import { BaseActorSheet } from '@vttforge/core';

const SYSTEM_ID = '{{ID}}';

const ABILITY_LABELS = {
  str: '{{LOCALE_PREFIX}}.Ability.str',
  dex: '{{LOCALE_PREFIX}}.Ability.dex',
  con: '{{LOCALE_PREFIX}}.Ability.con',
  int: '{{LOCALE_PREFIX}}.Ability.int',
  wis: '{{LOCALE_PREFIX}}.Ability.wis',
  cha: '{{LOCALE_PREFIX}}.Ability.cha',
};

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
    sheet: { template: `systems/${SYSTEM_ID}/templates/actor/character-sheet.hbs` },
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

  static DRAG_DROP = [{ dragSelector: '.sh-item[draggable=true]', dropSelector: '.sh-body' }];

  /**
   * The actor this sheet is for. One place to read `this.document` from, so
   * the rest of the sheet says `this.actor` and means it.
   * @returns {any}
   */
  get actor() {
    return this.document;
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const { actor } = this;
    const { system } = actor;

    context.actor = actor;
    context.system = system;
    context.isEditable = this.isEditable;
    context.abilities = Object.entries(system.abilities).map(([key, ability]) => ({
      key,
      label: game.i18n.localize(ABILITY_LABELS[key] ?? key),
      value: ability.value,
      mod: ability.mod,
    }));
    context.gear = actor.items
      .filter((item) => item.type === 'gear')
      .map((item) => ({
        id: item.id,
        name: item.name,
        img: item.img,
        kind: item.system.kind,
        quantity: item.system.quantity,
        weight: item.system.weight,
        description: item.system.description,
      }));
    context.enrichedBiography = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      system.biography,
      { relativeTo: actor, secrets: actor.isOwner },
    );
    return context;
  }

  /** Only gear belongs in this inventory. Anything else is refused with a reason. */
  async onDropItem(item, _event) {
    if (item?.type !== 'gear') {
      ui.notifications?.warn(
        game.i18n.format('{{LOCALE_PREFIX}}.Sheet.Drop.rejected', { type: item?.type ?? 'unknown' }),
      );
      return false;
    }
    return undefined;
  }

  // ApplicationV2 declares action handlers static and calls them with `this`
  // bound to the sheet instance.

  static async _onRollAbility(_event, target) {
    const key = target.dataset.ability;
    if (!key) return;
    const { actor } = this;
    const mod = actor.system.abilities[key]?.mod ?? 0;
    const roll = new Roll(`1d20 + ${mod}`, actor.getRollData());
    await roll.evaluate();
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: game.i18n.format('{{LOCALE_PREFIX}}.Sheet.Roll.flavor', {
        ability: game.i18n.localize(`{{LOCALE_PREFIX}}.Ability.${key}`),
      }),
    });
  }

  static async _onCreateGear() {
    await CONFIG.Item.documentClass.create(
      { name: game.i18n.localize('{{LOCALE_PREFIX}}.Sheet.NewGearName'), type: 'gear' },
      { parent: this.actor, renderSheet: true },
    );
  }

  static async _onDeleteItem(_event, target) {
    const id = target.closest('[data-item-id]')?.dataset.itemId;
    if (!id) return;
    await this.actor.items.get(id)?.delete();
  }
}
