// @vitest-environment happy-dom
/**
 * Boot smoke — loads scripts/main.mjs against mocked Foundry globals and
 * checks that `registerModule({...})` lands the sub-type, the sheet and the
 * enricher under the keys Foundry will look them up by.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function installFoundryGlobals() {
  const settings = new Map();
  const hooks = new Map();
  const registerSheet = vi.fn();

  globalThis.Hooks = {
    once(name, fn) {
      hooks.set(name, fn);
      return 0;
    },
    on() {
      return 0;
    },
  };

  globalThis.CONFIG = {
    Actor: { dataModels: {}, documentClass: class {} },
    Item: { dataModels: {}, documentClass: class {} },
    TextEditor: { enrichers: [] },
  };

  const moduleHandle = { id: 'vttforge-example-module' };
  globalThis.game = {
    user: { isGM: true },
    modules: { get: (id) => (id === moduleHandle.id ? moduleHandle : undefined) },
    settings: {
      register(namespace, key, config) {
        settings.set(`${namespace}.${key}`, config);
      },
      get(namespace, key) {
        const entry = settings.get(`${namespace}.${key}`);
        return entry?.value ?? entry?.default;
      },
    },
    i18n: { localize: (key) => key },
    items: { get: () => undefined },
  };

  globalThis.ui = { notifications: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } };

  globalThis.foundry = {
    abstract: { TypeDataModel: class {} },
    applications: {
      apps: { DocumentSheetConfig: { registerSheet } },
      api: {
        HandlebarsApplicationMixin: (base) => class extends base {},
      },
      sheets: { ActorSheetV2: class {}, ItemSheetV2: class {} },
      ux: { DragDrop: class {} },
    },
    data: { fields: {} },
    utils: {
      mergeObject(a, b) {
        return { ...a, ...b };
      },
    },
  };

  return { hooks, settings, registerSheet, moduleHandle };
}

let env;

beforeEach(() => {
  env = installFoundryGlobals();
  vi.resetModules();
});

afterEach(() => {
  delete globalThis.Hooks;
  delete globalThis.CONFIG;
  delete globalThis.game;
  delete globalThis.ui;
  delete globalThis.foundry;
});

describe('vttforge-example-module — boot', () => {
  it('loads main.mjs and registers init and ready', async () => {
    await import('../scripts/main.mjs?bootA');
    expect(env.hooks.has('init')).toBe(true);
    expect(env.hooks.has('ready')).toBe(true);
  });

  it('files the note sub-type under the module-prefixed key', async () => {
    await import('../scripts/main.mjs?bootB');
    env.hooks.get('init')();
    // A module's sub-types are namespaced; `note` alone would never appear.
    expect(CONFIG.Item.dataModels['vttforge-example-module.note']).toBeDefined();
    expect(CONFIG.Item.dataModels.note).toBeUndefined();
  });

  it('registers the note sheet under a key a rebuild cannot move', async () => {
    await import('../scripts/main.mjs?bootC');
    env.hooks.get('init')();
    expect(env.registerSheet).toHaveBeenCalledTimes(1);
    const [, scope, sheetClass, options] = env.registerSheet.mock.calls[0];
    expect(`${scope}.${sheetClass.name}`).toBe('vttforge-example-module.note');
    expect(options).toMatchObject({ types: ['vttforge-example-module.note'], makeDefault: true });
  });

  it('registers the enricher under the module namespace, with a global pattern', async () => {
    await import('../scripts/main.mjs?bootD');
    env.hooks.get('init')();
    const [enricher] = CONFIG.TextEditor.enrichers;
    expect(enricher.id).toBe('vttforge-example-module.note');
    expect(enricher.pattern.global).toBe(true);
    expect(typeof enricher.onRender).toBe('function');
  });

  it('exposes the API on the module handle and registers the setting', async () => {
    await import('../scripts/main.mjs?bootE');
    env.hooks.get('init')();
    expect(env.moduleHandle.api.noteType).toBe('vttforge-example-module.note');
    expect(typeof env.moduleHandle.api.createNote).toBe('function');
    expect(env.settings.has('vttforge-example-module.showWelcome')).toBe(true);
  });
});
