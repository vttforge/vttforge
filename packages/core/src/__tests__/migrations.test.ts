import { afterEach, describe, expect, it, vi } from 'vitest';
import { VttfError } from '../errors/registry.js';
import type { GameSettingsApi } from '../foundry-globals.js';
import { createMigrationRunner } from '../migrations/runner.js';
import type { Migration, MigrationLogger } from '../migrations/types.js';

function makeSettings(initial: Record<string, string> = {}): GameSettingsApi & {
  store: Record<string, string>;
  registerSpy: ReturnType<typeof vi.fn>;
} {
  const store: Record<string, string> = { ...initial };
  const registerSpy = vi.fn();
  return {
    store,
    registerSpy,
    register(namespace: string, key: string, config: unknown): void {
      registerSpy(namespace, key, config);
    },
    get<T = unknown>(namespace: string, key: string): T {
      return store[`${namespace}.${key}`] as unknown as T;
    },
    async set<T>(namespace: string, key: string, value: T): Promise<T> {
      store[`${namespace}.${key}`] = value as unknown as string;
      return value;
    },
  };
}

function makeLogger(): MigrationLogger & { calls: Array<[string, string]> } {
  const calls: Array<[string, string]> = [];
  return {
    calls,
    info: (m) => {
      calls.push(['info', m]);
    },
    warn: (m) => {
      calls.push(['warn', m]);
    },
    error: (m) => {
      calls.push(['error', m]);
    },
  };
}

const INITIAL = '0.0.0';
const FOUNDRY_NEWER = (next: string, current: string): boolean => {
  const parse = (v: string) => v.split('.').map((p) => Number.parseInt(p, 10) || 0);
  const a = parse(next);
  const b = parse(current);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    if (ai > bi) return true;
    if (ai < bi) return false;
  }
  return false;
};

afterEach(() => {
  delete (globalThis as Record<string, unknown>).foundry;
  delete (globalThis as Record<string, unknown>).game;
  delete (globalThis as Record<string, unknown>).ui;
});

describe('createMigrationRunner — basics', () => {
  it('targetVersion is the last migration version', () => {
    const runner = createMigrationRunner({
      systemId: 'sys',
      migrations: [
        { version: '1.0.0', fn: vi.fn() },
        { version: '2.0.0', fn: vi.fn() },
      ],
      settings: makeSettings(),
      logger: makeLogger(),
      isNewerVersion: FOUNDRY_NEWER,
    });
    expect(runner.targetVersion).toBe('2.0.0');
  });

  it('targetVersion is "0.0.0" when no migrations are declared', () => {
    const runner = createMigrationRunner({
      systemId: 'sys',
      migrations: [],
      settings: makeSettings(),
      logger: makeLogger(),
      isNewerVersion: FOUNDRY_NEWER,
    });
    expect(runner.targetVersion).toBe(INITIAL);
  });

  it('run() is a no-op when no migrations are declared', async () => {
    const runner = createMigrationRunner({
      systemId: 'sys',
      migrations: [],
      settings: makeSettings(),
      logger: makeLogger(),
      isNewerVersion: FOUNDRY_NEWER,
    });
    expect(await runner.run()).toEqual([]);
  });
});

describe('createMigrationRunner — register()', () => {
  it('registers the schemaVersion setting on the configured systemId', () => {
    const settings = makeSettings();
    const runner = createMigrationRunner({
      systemId: 'my-system',
      migrations: [{ version: '1.0.0', fn: vi.fn() }],
      settings,
      logger: makeLogger(),
      isNewerVersion: FOUNDRY_NEWER,
    });
    runner.register();
    expect(settings.registerSpy).toHaveBeenCalledTimes(1);
    const [namespace, key, config] = settings.registerSpy.mock.calls[0]!;
    expect(namespace).toBe('my-system');
    expect(key).toBe('schemaVersion');
    expect((config as { scope: string; config: boolean; default: string }).scope).toBe('world');
    expect((config as { config: boolean }).config).toBe(false);
    expect((config as { default: string }).default).toBe('0.0.0');
  });

  it('honours custom settingKey', () => {
    const settings = makeSettings();
    const runner = createMigrationRunner({
      systemId: 'sys',
      settingKey: 'dataVersion',
      migrations: [{ version: '1.0.0', fn: vi.fn() }],
      settings,
      logger: makeLogger(),
      isNewerVersion: FOUNDRY_NEWER,
    });
    runner.register();
    expect(settings.registerSpy.mock.calls[0]![1]).toBe('dataVersion');
  });
});

describe('createMigrationRunner — run()', () => {
  it('returns [] when stored version equals targetVersion', async () => {
    const settings = makeSettings({ 'sys.schemaVersion': '2.0.0' });
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    const runner = createMigrationRunner({
      systemId: 'sys',
      migrations: [
        { version: '1.0.0', fn: fn1 },
        { version: '2.0.0', fn: fn2 },
      ],
      settings,
      logger: makeLogger(),
      isNewerVersion: FOUNDRY_NEWER,
    });
    expect(await runner.run()).toEqual([]);
    expect(fn1).not.toHaveBeenCalled();
    expect(fn2).not.toHaveBeenCalled();
  });

  it('returns [] when stored version is newer than targetVersion', async () => {
    const settings = makeSettings({ 'sys.schemaVersion': '3.0.0' });
    const fn = vi.fn();
    const runner = createMigrationRunner({
      systemId: 'sys',
      migrations: [{ version: '2.0.0', fn }],
      settings,
      logger: makeLogger(),
      isNewerVersion: FOUNDRY_NEWER,
    });
    expect(await runner.run()).toEqual([]);
    expect(fn).not.toHaveBeenCalled();
  });

  it('runs every migration in order from a fresh world and advances schemaVersion to the target', async () => {
    const order: string[] = [];
    const settings = makeSettings();
    const runner = createMigrationRunner({
      systemId: 'sys',
      migrations: [
        {
          version: '1.0.0',
          fn: async () => {
            order.push('v1');
          },
        },
        {
          version: '1.5.0',
          fn: async () => {
            order.push('v1.5');
          },
        },
        {
          version: '2.0.0',
          fn: async () => {
            order.push('v2');
          },
        },
      ],
      settings,
      logger: makeLogger(),
      isNewerVersion: FOUNDRY_NEWER,
    });
    const ran = await runner.run();
    expect(order).toEqual(['v1', 'v1.5', 'v2']);
    expect(ran).toEqual(['1.0.0', '1.5.0', '2.0.0']);
    expect(settings.store['sys.schemaVersion']).toBe('2.0.0');
  });

  it('skips migrations already covered by stored version', async () => {
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    const fn3 = vi.fn();
    const settings = makeSettings({ 'sys.schemaVersion': '1.5.0' });
    const runner = createMigrationRunner({
      systemId: 'sys',
      migrations: [
        { version: '1.0.0', fn: fn1 },
        { version: '1.5.0', fn: fn2 },
        { version: '2.0.0', fn: fn3 },
      ],
      settings,
      logger: makeLogger(),
      isNewerVersion: FOUNDRY_NEWER,
    });
    const ran = await runner.run();
    expect(fn1).not.toHaveBeenCalled();
    expect(fn2).not.toHaveBeenCalled();
    expect(fn3).toHaveBeenCalledOnce();
    expect(ran).toEqual(['2.0.0']);
  });

  it('persists schemaVersion incrementally — each migration commits before the next starts', async () => {
    const settings = makeSettings();
    const observed: string[] = [];
    const runner = createMigrationRunner({
      systemId: 'sys',
      migrations: [
        {
          version: '1.0.0',
          fn: () => {
            observed.push(`before:${settings.store['sys.schemaVersion'] ?? 'undefined'}`);
          },
        },
        {
          version: '2.0.0',
          fn: () => {
            observed.push(`before:${settings.store['sys.schemaVersion'] ?? 'undefined'}`);
          },
        },
      ],
      settings,
      logger: makeLogger(),
      isNewerVersion: FOUNDRY_NEWER,
    });
    await runner.run();
    expect(observed).toEqual(['before:undefined', 'before:1.0.0']);
  });
});

describe('createMigrationRunner — VTTF-0004 failure handling', () => {
  it('wraps a thrown migration in VttfError VTTF-0004 with the original error as cause', async () => {
    const original = new Error('boom');
    const runner = createMigrationRunner({
      systemId: 'sys',
      migrations: [
        {
          version: '1.0.0',
          description: 'breaks things',
          fn: () => {
            throw original;
          },
        },
      ],
      settings: makeSettings(),
      logger: makeLogger(),
      isNewerVersion: FOUNDRY_NEWER,
    });
    const err = await runner.run().catch((e) => e);
    expect(err).toBeInstanceOf(VttfError);
    expect((err as VttfError).code).toBe('VTTF-0004');
    expect((err as VttfError).cause).toBe(original);
    expect((err as VttfError).message).toContain('breaks things');
  });

  it('leaves schemaVersion at the last successful migration when a later one throws', async () => {
    const settings = makeSettings();
    const runner = createMigrationRunner({
      systemId: 'sys',
      migrations: [
        { version: '1.0.0', fn: vi.fn() },
        { version: '2.0.0', fn: vi.fn() },
        {
          version: '3.0.0',
          fn: () => {
            throw new Error('nope');
          },
        },
      ],
      settings,
      logger: makeLogger(),
      isNewerVersion: FOUNDRY_NEWER,
    });
    await runner.run().catch(() => {});
    expect(settings.store['sys.schemaVersion']).toBe('2.0.0');
  });

  it('does not modify schemaVersion when the very first migration throws', async () => {
    const settings = makeSettings();
    const runner = createMigrationRunner({
      systemId: 'sys',
      migrations: [
        {
          version: '1.0.0',
          fn: () => {
            throw new Error('nope');
          },
        },
      ],
      settings,
      logger: makeLogger(),
      isNewerVersion: FOUNDRY_NEWER,
    });
    await runner.run().catch(() => {});
    expect(settings.store['sys.schemaVersion']).toBeUndefined();
  });

  it('throws VTTF-0004 when migrations are out of order', async () => {
    const runner = createMigrationRunner({
      systemId: 'sys',
      migrations: [
        { version: '2.0.0', fn: vi.fn() },
        { version: '1.0.0', fn: vi.fn() },
      ],
      settings: makeSettings(),
      logger: makeLogger(),
      isNewerVersion: FOUNDRY_NEWER,
    });
    const err = await runner.run().catch((e) => e);
    expect((err as VttfError).code).toBe('VTTF-0004');
    expect((err as VttfError).message).toContain('out of order');
  });
});

describe('createMigrationRunner — VTTF-0005 compatibleVersion floor', () => {
  it('throws VTTF-0005 when stored version is strictly older than compatibleVersion', async () => {
    const settings = makeSettings({ 'sys.schemaVersion': '0.5.0' });
    const runner = createMigrationRunner({
      systemId: 'sys',
      migrations: [{ version: '2.0.0', fn: vi.fn() }],
      compatibleVersion: '1.0.0',
      settings,
      logger: makeLogger(),
      isNewerVersion: FOUNDRY_NEWER,
    });
    const err = await runner.run().catch((e) => e);
    expect((err as VttfError).code).toBe('VTTF-0005');
  });

  it('allows runs when stored version equals compatibleVersion', async () => {
    const fn = vi.fn();
    const settings = makeSettings({ 'sys.schemaVersion': '1.0.0' });
    const runner = createMigrationRunner({
      systemId: 'sys',
      migrations: [{ version: '2.0.0', fn }],
      compatibleVersion: '1.0.0',
      settings,
      logger: makeLogger(),
      isNewerVersion: FOUNDRY_NEWER,
    });
    expect(await runner.run()).toEqual(['2.0.0']);
    expect(fn).toHaveBeenCalledOnce();
  });
});

describe('createMigrationRunner — default resolution fallbacks', () => {
  it('throws VTTF-0002 when run() is called without game.settings (and no override)', async () => {
    const runner = createMigrationRunner({
      systemId: 'sys',
      migrations: [{ version: '1.0.0', fn: vi.fn() }],
    });
    const err = await runner.run().catch((e) => e);
    expect(err).toBeInstanceOf(VttfError);
    expect((err as VttfError).code).toBe('VTTF-0002');
  });

  it('resolves foundry.utils.isNewerVersion from globalThis by default', async () => {
    const isNewer = vi.fn(
      (next: string, current: string) =>
        next.localeCompare(current, undefined, { numeric: true }) > 0,
    );
    (globalThis as Record<string, unknown>).foundry = { utils: { isNewerVersion: isNewer } };
    const runner = createMigrationRunner({
      systemId: 'sys',
      migrations: [{ version: '2.0.0', fn: vi.fn() }] as ReadonlyArray<Migration>,
      settings: makeSettings(),
      logger: makeLogger(),
    });
    await runner.run();
    expect(isNewer).toHaveBeenCalled();
  });
});
