/**
 * The package used the way a consumer would use it.
 *
 * Every `@vttforge/core` test builds these globals by hand, differently each
 * time. This is the same job done through the package, and it is the case
 * that would have caught a mock too thin to be useful.
 */
import { describe, expect, it } from 'vitest';
import { createMockActor } from '../vitest/mock-foundry.js';
import { withMockFoundry } from '../vitest/with-mock-foundry.js';

/** Stands in for a module's entry point. */
function registerExampleModule(): void {
  Hooks.once('init', () => {
    game.settings.register('example', 'cacheSize', {
      name: 'Cache size',
      scope: 'client',
      config: true,
      type: Number,
      default: 256,
    });
    CONFIG.Item.dataModels['example.pdf'] = class {};
  });

  Hooks.once('ready', () => {
    if (game.user.isGM) ui.notifications.info('example ready');
  });
}

describe('a module registered against the mock', () => {
  it('runs its whole lifecycle without a Foundry', () => {
    const mock = withMockFoundry();
    registerExampleModule();

    // Nothing has happened yet: the module only registered listeners.
    expect(mock.settings).toHaveLength(0);

    mock.callHook('init');
    expect(mock.settings[0]?.key).toBe('cacheSize');
    expect(game.settings.get('example', 'cacheSize')).toBe(256);
    expect(CONFIG.Item.dataModels['example.pdf']).toBeDefined();

    mock.callHook('ready');
    expect(mock.notifications).toEqual([{ level: 'info', message: 'example ready' }]);

    mock.restore();
  });

  it('lets the same lifecycle be driven as a player', () => {
    const mock = withMockFoundry({ user: { isGM: false } });
    registerExampleModule();
    mock.callHook('ready');
    // The GM-only branch did not run.
    expect(mock.notifications).toEqual([]);
    mock.restore();
  });

  it('checks what a sheet wrote to an actor', async () => {
    const mock = withMockFoundry();
    const actor = createMockActor({ system: { hp: { value: 10, max: 10 } } });

    // What a sheet's change handler does.
    await actor.update(foundry.utils.expandObject({ 'system.hp.value': 4 }));

    expect(actor.system.hp.value).toBe(4);
    expect(actor.system.hp.max).toBe(10);
    expect(actor.updates).toHaveLength(1);
    mock.restore();
  });
});
