import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isModuleActive, moduleApi, requireModuleApi } from '../module-api.js';
import { _resetRegisteredModulesForTests, registerModule } from '../register-module.js';

interface Handle {
  active?: boolean;
  api?: unknown;
}

let modules: Map<string, Handle>;
let hooks: Map<string, Array<() => void>>;

function world(): void {
  modules = new Map();
  hooks = new Map();
  (globalThis as Record<string, unknown>).game = {
    modules: { get: (id: string) => modules.get(id) },
  };
  (globalThis as Record<string, unknown>).CONFIG = {
    Actor: { dataModels: {} },
    Item: { dataModels: {} },
    Combat: {},
  };
  (globalThis as Record<string, unknown>).Hooks = {
    once: (event: string, fn: () => void) => {
      hooks.set(event, [...(hooks.get(event) ?? []), fn]);
      return 1;
    },
    on: () => 1,
  };
}

/** Fire the hook Foundry would fire. */
function fire(event: string): void {
  for (const fn of hooks.get(event) ?? []) fn();
}

beforeEach(() => {
  _resetRegisteredModulesForTests();
  world();
});

afterEach(() => {
  (globalThis as Record<string, unknown>).game = undefined;
  (globalThis as Record<string, unknown>).CONFIG = undefined;
  (globalThis as Record<string, unknown>).Hooks = undefined;
});

describe('publishing', () => {
  it('writes the api at the top of init, before the callbacks and the CONFIG mutations', () => {
    modules.set('my-module', { active: true });
    const api = { greet: () => 'hi' };
    const seen: unknown[] = [];

    registerModule({
      id: 'my-module',
      api,
      onBeforeInit: () => seen.push(modules.get('my-module')?.api),
      itemDataModels: { note: class {} },
    });

    expect(modules.get('my-module')?.api).toBeUndefined();
    fire('init');
    expect(modules.get('my-module')?.api).toBe(api);
    // Even the module's own first callback can read it back off the handle.
    expect(seen).toEqual([api]);
    expect(
      Object.keys(
        (globalThis as { CONFIG: { Item: { dataModels: object } } }).CONFIG.Item.dataModels,
      ),
    ).toEqual(['my-module.note']);
  });

  it('says so when the id does not match any installed module', () => {
    registerModule({ id: 'typo-module', api: { a: 1 } });
    expect(() => fire('init')).toThrow(/VTTF-0014[\s\S]*no module under that id/);
  });

  it('publishes nothing and complains about nothing when there is no module list', () => {
    (globalThis as Record<string, unknown>).game = {};
    registerModule({ id: 'my-module', api: { a: 1 } });
    // A unit test bench is not a world with a missing module.
    expect(() => fire('init')).not.toThrow();
  });

  it('leaves the handle alone when no api is given', () => {
    modules.set('my-module', { active: true });
    registerModule({ id: 'my-module' });
    fire('init');
    expect(modules.get('my-module')).toEqual({ active: true });
  });
});

describe('reading another package api', () => {
  it('hands back the api of a module that is on', () => {
    modules.set('other', { active: true, api: { version: 2 } });
    expect(moduleApi<{ version: number }>('other')?.version).toBe(2);
    expect(requireModuleApi<{ version: number }>('other').version).toBe(2);
    expect(isModuleActive('other')).toBe(true);
  });

  it('treats a module that is off as absent', () => {
    modules.set('other', { active: false, api: { version: 2 } });
    expect(moduleApi('other')).toBeUndefined();
    expect(isModuleActive('other')).toBe(false);
  });

  it('tells the failures apart, which the bare read cannot', () => {
    expect(() => requireModuleApi('nowhere')).toThrow(/No module "nowhere" is installed/);

    modules.set('off', { active: false });
    expect(() => requireModuleApi('off')).toThrow(/switched off[\s\S]*Manage Modules/);

    // On, but nothing published. Nothing orders one package's init against
    // another's, so this is what a read during init looks like when the other
    // module is perfectly fine.
    modules.set('quiet', { active: true });
    expect(() => requireModuleApi('quiet')).toThrow(/before its own init[\s\S]*onSetup/);
  });

  it('does not claim a module is missing before Foundry has a module list', () => {
    // The failure this helper exists to prevent, aimed at itself: called too
    // early it must not tell anyone to install what is already installed.
    (globalThis as Record<string, unknown>).game = undefined;
    expect(moduleApi('other')).toBeUndefined();
    expect(isModuleActive('other')).toBe(false);
    expect(() => requireModuleApi('other')).toThrow(/not built its module list yet/);
    expect(() => requireModuleApi('other')).not.toThrow(/is installed/);
  });
});
