// @vitest-environment happy-dom
/**
 * Integration smoke — boots scripts/main.mjs against fully mocked Foundry
 * globals and asserts the whole `registerSystem({...})` pipeline lands
 * without throwing.
 *
 * Why this exists: PR 5–8 each ship runtime helpers that are individually
 * unit-tested in @vttforge/core. This file is the only place that wires them
 * together exactly the way Foundry will, so we catch integration drift
 * (e.g. someone renames a global, sheet registration drops a type) before
 * loading the system inside a real Foundry instance.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function installFoundryGlobals() {
  const settings = new Map();
  const hooks = new Map();
  const registerSheet = vi.fn();
  const actorUnregister = vi.fn();
  const itemUnregister = vi.fn();

  globalThis.Hooks = {
    once(name, fn) {
      hooks.set(name, fn);
      return 0;
    },
    on() {
      return 0;
    },
    off() {
      return false;
    },
    call() {
      return true;
    },
    callAll() {
      return true;
    },
  };

  globalThis.CONFIG = {
    Actor: { dataModels: {}, documentClass: class {} },
    Item: { dataModels: {}, documentClass: class {} },
    Combat: { initiative: undefined },
    ActiveEffect: { legacyTransferral: true },
    statusEffects: [],
  };

  globalThis.game = {
    user: { isGM: true },
    settings: {
      register(namespace, key, config) {
        settings.set(`${namespace}.${key}`, config);
      },
      get(namespace, key) {
        return (
          settings.get(`${namespace}.${key}`)?.value ?? settings.get(`${namespace}.${key}`)?.default
        );
      },
      async set(namespace, key, value) {
        const entry = settings.get(`${namespace}.${key}`) ?? {};
        entry.value = value;
        settings.set(`${namespace}.${key}`, entry);
        return value;
      },
    },
    actors: [],
  };

  globalThis.ui = {
    notifications: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  };

  globalThis.foundry = {
    abstract: { TypeDataModel: class {} },
    applications: {
      apps: {
        // What `registerSystem({ sheets })` registers through. Foundry keys a
        // sheet by `${scope}.${sheetClass.name}`, so the assertions below read
        // the name back to check the id was pinned.
        DocumentSheetConfig: { registerSheet },
      },
      api: {
        HandlebarsApplicationMixin: (base) =>
          class extends base {
            static _mixed = true;
          },
      },
      sheets: {
        ActorSheetV2: class {},
        ItemSheetV2: class {},
      },
      ux: { DragDrop: class {} },
    },
    data: { fields: {} },
    documents: {
      collections: {
        Actors: { unregisterSheet: actorUnregister },
        Items: { unregisterSheet: itemUnregister },
      },
    },
    utils: {
      mergeObject(a, b) {
        return { ...a, ...b };
      },
      isNewerVersion(next, current) {
        const parse = (v) =>
          String(v)
            .split('.')
            .map((p) => Number.parseInt(p, 10) || 0);
        const A = parse(next);
        const B = parse(current);
        for (let i = 0; i < Math.max(A.length, B.length); i++) {
          const ai = A[i] ?? 0;
          const bi = B[i] ?? 0;
          if (ai > bi) return true;
          if (ai < bi) return false;
        }
        return false;
      },
    },
  };

  return { hooks, settings, registerSheet, actorUnregister, itemUnregister };
}

let env;

beforeEach(() => {
  env = installFoundryGlobals();
  // Force re-import so the registered-systems guard inside @vttforge/core
  // doesn't carry state across tests.
  vi.resetModules();
});

afterEach(() => {
  delete globalThis.Hooks;
  delete globalThis.CONFIG;
  delete globalThis.game;
  delete globalThis.ui;
  delete globalThis.foundry;
});

describe('vttforge-example — boot', () => {
  it('loads main.mjs without throwing', async () => {
    await expect(import('../scripts/main.mjs?bootA')).resolves.toBeDefined();
  });

  it('registers init and ready hooks on Foundry', async () => {
    await import('../scripts/main.mjs?bootB');
    expect(env.hooks.has('init')).toBe(true);
    expect(env.hooks.has('ready')).toBe(true);
  });

  it('populates CONFIG.Actor.dataModels.character and CONFIG.Item.dataModels.gear on init', async () => {
    await import('../scripts/main.mjs?bootC');
    const initFn = env.hooks.get('init');
    expect(typeof initFn).toBe('function');
    initFn();
    expect(CONFIG.Actor.dataModels.character).toBeDefined();
    expect(CONFIG.Item.dataModels.gear).toBeDefined();
  });

  it('registers the schemaVersion setting via the migration runner', async () => {
    await import('../scripts/main.mjs?bootD');
    env.hooks.get('init')();
    expect(env.settings.has('vttforge-example.schemaVersion')).toBe(true);
    expect(env.settings.has('vttforge-example.showTutorial')).toBe(true);
  });

  it('registers Character and Gear sheets with the right type filters', async () => {
    await import('../scripts/main.mjs?bootE');
    env.hooks.get('init')();
    expect(env.actorUnregister).toHaveBeenCalled();
    expect(env.itemUnregister).toHaveBeenCalled();
    expect(env.registerSheet).toHaveBeenCalledWith(
      expect.anything(),
      'vttforge-example',
      expect.any(Function),
      expect.objectContaining({ types: ['character'], makeDefault: true }),
    );
    expect(env.registerSheet).toHaveBeenCalledWith(
      expect.anything(),
      'vttforge-example',
      expect.any(Function),
      expect.objectContaining({ types: ['gear'], makeDefault: true }),
    );
  });

  it('gives each sheet a key that a rebuild cannot move', async () => {
    await import('../scripts/main.mjs?bootE2');
    env.hooks.get('init')();
    // Foundry saves `${scope}.${sheetClass.name}` on every document using the
    // sheet, and a minifier renames classes between builds. The `id` is what
    // makes these two keys the same in every build.
    const keys = env.registerSheet.mock.calls.map(([, scope, cls]) => `${scope}.${cls.name}`);
    expect(keys).toEqual(['vttforge-example.character', 'vttforge-example.gear']);
  });

  it('runs migrations on ready (advancing schemaVersion to 0.1.0)', async () => {
    await import('../scripts/main.mjs?bootF');
    env.hooks.get('init')();
    await env.hooks.get('ready')();
    expect(env.settings.get('vttforge-example.schemaVersion')?.value).toBe('0.1.0');
  });

  it('sets the initiative formula', async () => {
    await import('../scripts/main.mjs?bootG');
    env.hooks.get('init')();
    expect(CONFIG.Combat.initiative).toEqual({
      formula: '1d20 + @abilities.dex.mod',
      decimals: 2,
    });
  });
});
