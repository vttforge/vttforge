import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VttfError } from '../errors/registry.js';
import { SystemConfig } from '../system-config.js';

interface FakeGame {
  settings: {
    register: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
  };
}

const SYSTEM_ID = 'my-system';

let fakeGame: FakeGame;

beforeEach(() => {
  fakeGame = {
    settings: {
      register: vi.fn(),
      get: vi.fn(),
      set: vi.fn().mockImplementation(async (_ns, _key, value) => value),
    },
  };
  (globalThis as Record<string, unknown>).game = fakeGame;
});

afterEach(() => {
  delete (globalThis as Record<string, unknown>).game;
});

describe('SystemConfig', () => {
  it('forwards register() to game.settings.register with the system id', () => {
    const cfg = new SystemConfig(SYSTEM_ID);
    cfg.register('homebrewRules', {
      scope: 'world',
      config: true,
      type: Boolean,
      default: false,
    });

    expect(fakeGame.settings.register).toHaveBeenCalledTimes(1);
    expect(fakeGame.settings.register).toHaveBeenCalledWith(
      SYSTEM_ID,
      'homebrewRules',
      expect.objectContaining({ scope: 'world', default: false }),
    );
    expect(cfg.isRegistered('homebrewRules')).toBe(true);
  });

  it('get() forwards after register()', () => {
    const cfg = new SystemConfig(SYSTEM_ID);
    cfg.register('homebrewRules', { scope: 'world', type: Boolean, default: false });
    fakeGame.settings.get.mockReturnValue(true);

    const value = cfg.get<boolean>('homebrewRules');

    expect(fakeGame.settings.get).toHaveBeenCalledWith(SYSTEM_ID, 'homebrewRules');
    expect(value).toBe(true);
  });

  it('set() forwards and returns the value', async () => {
    const cfg = new SystemConfig(SYSTEM_ID);
    cfg.register('homebrewRules', { scope: 'world', type: Boolean, default: false });

    const result = await cfg.set('homebrewRules', true);

    expect(fakeGame.settings.set).toHaveBeenCalledWith(SYSTEM_ID, 'homebrewRules', true);
    expect(result).toBe(true);
  });

  it('throws VTTF-0003 when reading an unregistered key', () => {
    const cfg = new SystemConfig(SYSTEM_ID);

    expect(() => cfg.get('missingKey')).toThrow(VttfError);
    try {
      cfg.get('missingKey');
    } catch (err) {
      expect((err as VttfError).code).toBe('VTTF-0003');
    }
  });

  it('throws VTTF-0003 when writing an unregistered key', async () => {
    const cfg = new SystemConfig(SYSTEM_ID);

    await expect(cfg.set('missingKey', true)).rejects.toBeInstanceOf(VttfError);
    await expect(cfg.set('missingKey', true)).rejects.toMatchObject({ code: 'VTTF-0003' });
  });

  it('throws VTTF-0002 when game.settings is unavailable', () => {
    delete (globalThis as Record<string, unknown>).game;
    const cfg = new SystemConfig(SYSTEM_ID);

    expect(() =>
      cfg.register('homebrewRules', { scope: 'world', type: Boolean, default: false }),
    ).toThrow(VttfError);
  });
});
