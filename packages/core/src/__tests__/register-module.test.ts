/**
 * A module contributing document sub-types.
 *
 * The prefix is the whole point. Foundry files a module's sub-type under
 * `<module-id>.<type>`, and a module that registers the bare name gets no
 * error — the type just never shows up. These cases pin the prefixing, and
 * pin what a module is deliberately not allowed to do.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FoundryConfig } from '../foundry-globals.js';
import {
  _resetRegisteredModulesForTests,
  moduleSubType,
  registerModule,
} from '../register-module.js';

const MODULE_ID = 'pdf-character-sheet';

class PdfItemData {}
class PdfActorData {}

let CONFIG: FoundryConfig;
let initHooks: Array<() => void>;
let readyHooks: Array<() => void>;

beforeEach(() => {
  _resetRegisteredModulesForTests();
  initHooks = [];
  readyHooks = [];
  CONFIG = {
    Actor: { dataModels: {}, documentClass: 'SystemActor' },
    Item: { dataModels: {}, documentClass: 'SystemItem' },
    Combat: { initiative: { formula: '1d20' } },
    ActiveEffect: {},
    statusEffects: [{ id: 'system.prone' }],
  };
  (globalThis as Record<string, unknown>).CONFIG = CONFIG;
  (globalThis as Record<string, unknown>).Hooks = {
    once: (event: string, fn: () => void) => {
      if (event === 'init') initHooks.push(fn);
      if (event === 'ready') readyHooks.push(fn);
      return 0;
    },
  };
});

afterEach(() => {
  delete (globalThis as Record<string, unknown>).CONFIG;
  delete (globalThis as Record<string, unknown>).Hooks;
});

const fireInit = () => {
  for (const fn of initHooks) fn();
};

describe('moduleSubType', () => {
  it('joins the module id and the bare type', () => {
    expect(moduleSubType(MODULE_ID, 'pdf')).toBe('pdf-character-sheet.pdf');
  });
});

describe('registerModule', () => {
  it('files item sub-types under the prefixed key, not the bare one', () => {
    registerModule({ id: MODULE_ID, itemDataModels: { pdf: PdfItemData } });
    fireInit();

    expect(CONFIG.Item.dataModels['pdf-character-sheet.pdf']).toBe(PdfItemData);
    // The bare key is what a system would use. A module writing it gets no
    // error from Foundry and no sub-type either.
    expect(CONFIG.Item.dataModels.pdf).toBeUndefined();
  });

  it('does the same for actor sub-types', () => {
    registerModule({ id: MODULE_ID, actorDataModels: { sheet: PdfActorData } });
    fireInit();
    expect(CONFIG.Actor.dataModels['pdf-character-sheet.sheet']).toBe(PdfActorData);
  });

  it('leaves the system document classes alone', () => {
    registerModule({ id: MODULE_ID, itemDataModels: { pdf: PdfItemData } });
    fireInit();
    expect(CONFIG.Actor.documentClass).toBe('SystemActor');
    expect(CONFIG.Item.documentClass).toBe('SystemItem');
  });

  it('leaves the initiative formula alone', () => {
    registerModule({ id: MODULE_ID });
    fireInit();
    expect(CONFIG.Combat.initiative).toEqual({ formula: '1d20' });
  });

  it('appends status effects rather than replacing the array', () => {
    // Replacing it would delete the system's own conditions.
    registerModule({ id: MODULE_ID, statusEffects: [{ id: 'pdf-character-sheet.reading' }] });
    fireInit();
    expect(CONFIG.statusEffects).toEqual([
      { id: 'system.prone' },
      { id: 'pdf-character-sheet.reading' },
    ]);
  });

  it('defers every mutation to the init hook', () => {
    registerModule({ id: MODULE_ID, itemDataModels: { pdf: PdfItemData } });
    expect(CONFIG.Item.dataModels).toEqual({});
  });

  it('runs onBeforeInit before the mutations and onAfterInit after', () => {
    const order: string[] = [];
    registerModule({
      id: MODULE_ID,
      itemDataModels: { pdf: PdfItemData },
      onBeforeInit: () => order.push(`before:${Object.keys(CONFIG.Item.dataModels).length}`),
      onAfterInit: () => order.push(`after:${Object.keys(CONFIG.Item.dataModels).length}`),
    });
    fireInit();
    expect(order).toEqual(['before:0', 'after:1']);
  });

  it('runs onReady on the ready hook, not on init', () => {
    const onReady = vi.fn();
    registerModule({ id: MODULE_ID, onReady });
    fireInit();
    expect(onReady).not.toHaveBeenCalled();
    for (const fn of readyHooks) fn();
    expect(onReady).toHaveBeenCalledOnce();
  });

  it('refuses a second registration of the same id', () => {
    registerModule({ id: MODULE_ID });
    expect(() => registerModule({ id: MODULE_ID })).toThrow(/already registered/);
  });

  it('does not collide with a system of the same id', () => {
    expect(() => registerModule({ id: 'shared-id' })).not.toThrow();
  });

  it('registers sheets on init, keyed by the id rather than the class name', () => {
    const calls: Array<{ scope: string; name: string; documentClass: unknown }> = [];
    (globalThis as Record<string, unknown>).foundry = {
      applications: {
        apps: {
          DocumentSheetConfig: {
            registerSheet(documentClass: unknown, scope: string, sheetClass: { name: string }) {
              calls.push({ scope, name: sheetClass.name, documentClass });
            },
          },
        },
      },
    };
    // The name a bundler left on the class.
    class mo {}
    registerModule({
      id: MODULE_ID,
      sheets: [{ id: 'fillable', document: 'Actor', sheet: mo }],
    });
    fireInit();
    expect(calls).toEqual([
      { scope: 'pdf-character-sheet', name: 'fillable', documentClass: 'SystemActor' },
    ]);
    delete (globalThis as Record<string, unknown>).foundry;
  });
});
