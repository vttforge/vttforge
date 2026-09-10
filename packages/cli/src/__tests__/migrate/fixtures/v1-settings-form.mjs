export class HeroSettingsForm extends FormApplication {
  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: 'hero-settings',
      classes: ['hero', 'settings-menu'],
      title: 'HERO.Settings.Title',
      template: 'modules/hero/templates/settings.hbs',
      width: 550,
      height: 'auto',
      closeOnSubmit: false,
    });
  }

  /** @override */
  async getData() {
    const context = await super.getData();
    context.settings = Object.entries(this.constructor.SETTINGS).map(([key, setting]) => ({
      ...setting,
      key,
      value: game.settings.get('hero', key),
    }));
    return context;
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);
    html.find('.reset').click(this._onReset.bind(this));
  }

  async _onReset(event) {
    event.preventDefault();
    const ok = await Dialog.confirm({
      title: 'Reset',
      content: '<p>Reset all?</p>',
      yes: () => true,
      no: () => false,
    });
    if (ok) await this.render();
  }

  /** @override */
  async _updateObject(_event, data) {
    for (const key of Object.keys(data)) {
      await game.settings.set('hero', key, data[key]);
    }
  }
}
