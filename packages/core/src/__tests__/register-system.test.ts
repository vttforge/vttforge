import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VttfError } from '../errors/registry.js';
import {
  _resetRegisteredSystemsForTests,
  registerSystem,
  type SystemRegistration,
} from '../register-system.js';

interface FakeHooks {
  once: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
  call: ReturnType<typeof vi.fn>;
  callAll: ReturnType<typeof vi.fn>;
}

interface FakeConfig {
  Actor: { dataModels: Record<string, unknown>; documentClass: unknown };
  Item: { dataModels: Record<string, unknown>; documentClass: unknown };
  Combat: { initiative: unknown };
  ActiveEffect: { legacyTransferral: boolean };
  statusEffects: unknown[];
}

function setupFoundryGlobals(): { hooks: FakeHooks; config: FakeConfig } {
  const hooks: FakeHooks = {
    once: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    call: vi.fn(),
    callAll: vi.fn(),
  };
  const config: FakeConfig = {
    Actor: { dataModels: {}, documentClass: undefined },
    Item: { dataModels: {}, documentClass: undefined },
    Combat: { initiative: undefined },
    ActiveEffect: { legacyTransferral: true },
    statusEffects: [],
  };
  (globalThis as Record<string, unknown>).Hooks = hooks;
  (globalThis as Record<string, unknown>).CONFIG = config;
  return { hooks, config };
}

beforeEach(() => {
  _resetRegisteredSystemsForTests();
});

afterEach(() => {
  delete (globalThis as Record<string, unknown>).Hooks;
  delete (globalThis as Record<string, unknown>).CONFIG;
});

describe('registerSystem', () => {
  it('schedules its CONFIG mutations via Hooks.once("init")', () => {
    const { hooks } = setupFoundryGlobals();
    registerSystem({ id: 'my-system' });
    expect(hooks.once).toHaveBeenCalledTimes(1);
    expect(hooks.once).toHaveBeenCalledWith('init', expect.any(Function));
  });

  it('applies dataModels, document class, initiative, and statusEffects on init', () => {
    const { hooks, config } = setupFoundryGlobals();
    const HeroData = class {};
    const NpcData = class {};
    const Actor = class {};
    const Item = class {};
    const status = [{ id: 'my-system.prone' }];

    const registration: SystemRegistration = {
      id: 'my-system',
      actorDataModels: { hero: HeroData, npc: NpcData },
      itemDataModels: { weapon: class {} },
      actorDocumentClass: Actor,
      itemDocumentClass: Item,
      combat: { initiative: { formula: '1d20 + @abilities.dex.mod', decimals: 2 } },
      statusEffects: status,
    };
    registerSystem(registration);

    const initCallback = hooks.once.mock.calls[0]?.[1] as () => void;
    initCallback();

    expect(config.Actor.dataModels).toMatchObject({ hero: HeroData, npc: NpcData });
    expect(config.Item.dataModels.weapon).toBeDefined();
    expect(config.Actor.documentClass).toBe(Actor);
    expect(config.Item.documentClass).toBe(Item);
    expect(config.Combat.initiative).toEqual({ formula: '1d20 + @abilities.dex.mod', decimals: 2 });
    expect(config.ActiveEffect.legacyTransferral).toBe(false); // default
    expect(config.statusEffects).toEqual(status);
  });

  it('runs onBeforeInit before, and onAfterInit after, the CONFIG mutations', () => {
    const { hooks, config } = setupFoundryGlobals();
    const calls: string[] = [];
    const before = vi.fn(() => {
      calls.push('before');
      expect(Object.keys(config.Actor.dataModels)).toHaveLength(0);
    });
    const after = vi.fn(() => {
      calls.push('after');
      expect(Object.keys(config.Actor.dataModels)).toHaveLength(1);
    });

    registerSystem({
      id: 'my-system',
      actorDataModels: { hero: class {} },
      onBeforeInit: before,
      onAfterInit: after,
    });

    const initCallback = hooks.once.mock.calls[0]?.[1] as () => void;
    initCallback();
    expect(before).toHaveBeenCalledOnce();
    expect(after).toHaveBeenCalledOnce();
    expect(calls).toEqual(['before', 'after']);
  });

  it('throws VTTF-0001 when the same system id registers twice (hot-reload guard)', () => {
    setupFoundryGlobals();
    registerSystem({ id: 'my-system' });

    expect(() => registerSystem({ id: 'my-system' })).toThrow(VttfError);
    try {
      registerSystem({ id: 'my-system' });
    } catch (err) {
      expect((err as VttfError).code).toBe('VTTF-0001');
    }
  });

  it('throws VTTF-0002 when Hooks global is missing', () => {
    expect(() => registerSystem({ id: 'my-system' })).toThrow(VttfError);
  });

  it('throws VTTF-0002 when CONFIG global is missing at init time', () => {
    const { hooks } = setupFoundryGlobals();
    delete (globalThis as Record<string, unknown>).CONFIG;
    registerSystem({ id: 'my-system' });
    const initCallback = hooks.once.mock.calls[0]?.[1] as () => void;
    expect(() => initCallback()).toThrow(VttfError);
  });

  it('does not register a ready hook when onReady is omitted', () => {
    const { hooks } = setupFoundryGlobals();
    registerSystem({ id: 'my-system' });
    const readyCalls = hooks.once.mock.calls.filter((call) => call[0] === 'ready');
    expect(readyCalls).toHaveLength(0);
  });

  it('schedules onReady via Hooks.once("ready")', () => {
    const { hooks } = setupFoundryGlobals();
    const onReady = vi.fn();
    registerSystem({ id: 'my-system', onReady });
    const readyCall = hooks.once.mock.calls.find((call) => call[0] === 'ready');
    expect(readyCall).toBeDefined();
    expect(typeof readyCall?.[1]).toBe('function');
  });

  it('invokes onReady when the ready hook fires', () => {
    const { hooks } = setupFoundryGlobals();
    const onReady = vi.fn();
    registerSystem({ id: 'my-system', onReady });
    const readyCallback = hooks.once.mock.calls.find((call) => call[0] === 'ready')?.[1] as
      | (() => void)
      | undefined;
    expect(readyCallback).toBeDefined();
    readyCallback?.();
    expect(onReady).toHaveBeenCalledOnce();
  });

  it('supports async onReady (returned promise is fire-and-forget)', async () => {
    const { hooks } = setupFoundryGlobals();
    let resolved = false;
    const onReady = vi.fn(async () => {
      await Promise.resolve();
      resolved = true;
    });
    registerSystem({ id: 'my-system', onReady });
    const readyCallback = hooks.once.mock.calls.find((call) => call[0] === 'ready')?.[1] as
      | (() => void)
      | undefined;
    readyCallback?.();
    await new Promise((r) => setTimeout(r, 0));
    expect(resolved).toBe(true);
    expect(onReady).toHaveBeenCalledOnce();
  });
});
