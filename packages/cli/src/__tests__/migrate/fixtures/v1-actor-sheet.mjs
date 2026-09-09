import { helper } from '../utils.mjs';

export class HeroSheet extends ActorSheet {
  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ['hero', 'sheet', 'actor'],
      template: 'systems/hero/templates/actor-sheet.html',
      width: 600,
      height: 750,
      tabs: [{ navSelector: '.tabs', contentSelector: '.content', initial: 'items' }],
      dragDrop: [{ dragSelector: '.item-row', dropSelector: null }],
    });
  }

  /** @override */
  async getData() {
    const data = await super.getData();
    data.items = data.items.sort((a, b) => a.name.localeCompare(b.name));
    data.enrichedNotes = await TextEditor.enrichHTML(this.actor.system.notes, { async: true });
    return data;
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);
    if (!this.options.editable) return;
    html.find('.item-create').click(this._onItemCreate.bind(this));
    html.find('.item-delete').click(async (ev) => {
      const li = $(ev.currentTarget).closest('.item-row');
      const ok = await Dialog.confirm({
        title: 'Delete',
        content: '<p>Sure?</p>',
        yes: () => true,
        no: () => false,
      });
      if (ok) await this.actor.deleteEmbeddedDocuments('Item', [li.data('itemId')]);
    });
    html.find('.item-name').dblclick((event) => this._onItemEdit(event));
    html.find('[name="system.armed"]').change((e) => {
      if (e.target.checked) html.find('[name="system.hidden"]')[0].checked = false;
    });
    html.find('#rest-button').click(async () => {
      await this.actor.update({ 'system.hp.value': this.actor.system.hp.max });
    });
  }

  async _onItemCreate(event) {
    event.preventDefault();
    new Dialog({
      title: 'New item',
      content: '<input name="name">',
      buttons: {
        create: {
          label: 'Create',
          callback: (html) =>
            this.actor.createEmbeddedDocuments('Item', [
              { name: html.find('[name=name]').val(), type: 'item' },
            ]),
        },
      },
    }).render(true);
  }

  _onItemEdit(event) {
    const li = $(event.currentTarget).closest('.item-row');
    this.actor.items.get(li.data('itemId')).sheet.render(true);
  }

  /** @override */
  async _onDropItem(event, itemData) {
    const item = ((await super._onDropItem(event, itemData)) || []).pop();
    if (item) helper(item);
    return item;
  }

  /** @override */
  setPosition(options = {}) {
    const position = super.setPosition(options);
    this.element.find('.sheet-body').css('height', position.height - 100);
    return position;
  }

  /** @override */
  _onDragStart(event) {
    const id = event.currentTarget.dataset.itemId;
    event.dataTransfer.setData('text/plain', JSON.stringify(this.actor.items.get(id).toDragData()));
  }
}
