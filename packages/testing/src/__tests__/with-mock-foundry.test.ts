import { afterEach, describe, expect, it } from 'vitest';
import { createMockActor, createMockItem } from '../vitest/mock-foundry.js';
import { type MockFoundry, withMockFoundry } from '../vitest/with-mock-foundry.js';

let mock: MockFoundry | undefined;

afterEach(() => {
  mock?.restore();
  mock = undefined;
});

describe('withMockFoundry', () => {
  it('installs the globals a package reaches for', () => {
    mock = withMockFoundry();
    for (const name of ['foundry', 'game', 'CONFIG', 'Hooks', 'ui', 'CONST']) {
      expect((globalThis as Record<string, unknown>)[name]).toBeDefined();
    }
  });

  it('puts every global back, including ones that never existed', () => {
    const scope = globalThis as Record<string, unknown>;
    scope.game = { sentinel: true };
    expect(scope.foundry).toBeUndefined();

    const active = withMockFoundry();
    expect(scope.foundry).toBeDefined();
    active.restore();

    // The pre-existing one is restored, and the invented one is gone rather
    // than left behind as an empty object.
    expect(scope.game).toEqual({ sentinel: true });
    expect(scope.foundry).toBeUndefined();
    delete scope.game;
  });

  it('records hook registrations instead of swallowing them', () => {
    mock = withMockFoundry();
    Hooks.once('init', () => 'from init');
    Hooks.on('ready', () => 'from ready');

    expect(mock.hooks.map((h) => [h.event, h.once])).toEqual([
      ['init', true],
      ['ready', false],
    ]);
  });

  it('fires hooks so a test can drive a lifecycle', () => {
    mock = withMockFoundry();
    let ran = false;
    Hooks.once('init', () => {
      ran = true;
    });
    mock.callHook('init');
    expect(ran).toBe(true);
  });

  it('records settings and serves their defaults back', () => {
    mock = withMockFoundry();
    game.settings.register('my-module', 'showWelcome', { type: Boolean, default: true });

    expect(mock.settings[0]).toMatchObject({ namespace: 'my-module', key: 'showWelcome' });
    expect(game.settings.get('my-module', 'showWelcome')).toBe(true);
  });

  it('collects notifications with their severity', () => {
    mock = withMockFoundry();
    ui.notifications.warn('careful');
    ui.notifications.error('broken');
    expect(mock.notifications).toEqual([
      { level: 'warn', message: 'careful' },
      { level: 'error', message: 'broken' },
    ]);
  });

  it('defaults the user to a GM, which is what module code checks', () => {
    mock = withMockFoundry();
    expect(game.user.isGM).toBe(true);
  });

  it('lets a test be a player instead', () => {
    mock = withMockFoundry({ user: { isGM: false } });
    expect(game.user.isGM).toBe(false);
  });

  it('expands dotted paths the way foundry.utils does', () => {
    mock = withMockFoundry();
    expect(foundry.utils.expandObject({ 'system.hp.value': 3 })).toEqual({
      system: { hp: { value: 3 } },
    });
    expect(foundry.utils.flattenObject({ system: { hp: { value: 3 } } })).toEqual({
      'system.hp.value': 3,
    });
  });
});

describe('extra globals', () => {
  it('installs a global the fixed set does not cover', () => {
    // Foundry puts every document class on the global scope, and code under
    // test reaches for them by name: Actor.create, JournalEntry.create.
    const JournalEntry = { create: () => Promise.resolve({ id: 'j1' }) };
    mock = withMockFoundry({ globals: { JournalEntry } });
    expect((globalThis as Record<string, unknown>).JournalEntry).toBe(JournalEntry);
  });

  it('removes it again on restore', () => {
    withMockFoundry({ globals: { JournalEntry: {} } }).restore();
    expect('JournalEntry' in globalThis).toBe(false);
  });

  it('puts back a value that was already there', () => {
    const scope = globalThis as Record<string, unknown>;
    scope.JournalEntry = 'the original';
    withMockFoundry({ globals: { JournalEntry: 'the mock' } }).restore();
    expect(scope.JournalEntry).toBe('the original');
    delete scope.JournalEntry;
  });

  it('lets you override one of the built-ins', () => {
    mock = withMockFoundry({ globals: { CONST: { mine: true } } });
    expect((globalThis as Record<string, unknown>).CONST).toEqual({ mine: true });
  });
});

describe('mock documents', () => {
  it('records every update the code under test made', async () => {
    const actor = createMockActor({ name: 'Vitória' });
    await actor.update({ name: 'Renamed' });
    expect(actor.updates).toEqual([{ name: 'Renamed' }]);
    expect(actor.name).toBe('Renamed');
  });

  it('applies a dotted update to the nested path, not to a dotted key', async () => {
    // This is how Foundry updates arrive, and code under test relies on it.
    const actor = createMockActor({ system: { hp: { value: 10 } } });
    await actor.update({ 'system.hp.value': 3 });
    expect(actor.system.hp.value).toBe(3);
    expect(Object.keys(actor.system)).toEqual(['hp']);
  });

  it('round-trips flags', async () => {
    const item = createMockItem();
    await item.setFlag('my-module', 'code', 'OP');
    expect(item.getFlag('my-module', 'code')).toBe('OP');
    await item.unsetFlag('my-module', 'code');
    expect(item.getFlag('my-module', 'code')).toBeUndefined();
  });

  it('merges an update rather than replacing the branch', async () => {
    // Foundry merges. A mock that replaces lets a test pass while the real
    // thing drops every sibling key — which is how this was found.
    const actor = createMockActor({ system: { hp: { value: 10, max: 10 } } });
    await actor.update({ system: { hp: { value: 4 } } });
    expect(actor.system.hp).toEqual({ value: 4, max: 10 });
  });

  it('replaces arrays wholesale, also like Foundry', async () => {
    const actor = createMockActor({ system: { tags: ['a', 'b'] } });
    await actor.update({ system: { tags: ['c'] } });
    expect(actor.system.tags).toEqual(['c']);
  });

  it('gives each document a distinct id', () => {
    expect(createMockActor().id).not.toBe(createMockActor().id);
  });
});
