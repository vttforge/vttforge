/**
 * The timing is what these decorators exist for, so it is what these cases
 * check: nothing may touch CONFIG until `init` fires.
 *
 * Driven through `@vttforge/testing`, which is also the first real use of
 * that package outside its own suite.
 */
import { type MockFoundry, withMockFoundry } from '@vttforge/testing/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ActorDataModel,
  DocumentSheet,
  ItemDataModel,
  OnHook,
  SystemSetting,
} from '../decorators.js';
import { VttfError } from '../errors/registry.js';

let mock: MockFoundry | undefined;

afterEach(() => {
  mock?.restore();
  mock = undefined;
});

describe('@ActorDataModel', () => {
  it('registers nothing until init fires', () => {
    mock = withMockFoundry();

    @ActorDataModel('character')
    class CharacterData {}
    void CharacterData;

    // Defining the class is not enough, and must not be: CONFIG may only be
    // touched inside init, and the class is defined at import time.
    expect(CONFIG.Actor.dataModels).toEqual({});

    mock.callHook('init');
    expect(CONFIG.Actor.dataModels.character).toBe(CharacterData);
  });

  it('files a module subtype under its prefixed key', () => {
    mock = withMockFoundry();

    @ActorDataModel('my-module.vehicle')
    class VehicleData {}

    mock.callHook('init');
    expect(CONFIG.Actor.dataModels['my-module.vehicle']).toBe(VehicleData);
  });
});

describe('@ItemDataModel', () => {
  it('registers on the Item bag', () => {
    mock = withMockFoundry();

    @ItemDataModel('weapon')
    class WeaponData {}

    mock.callHook('init');
    expect(CONFIG.Item.dataModels.weapon).toBe(WeaponData);
    expect(CONFIG.Actor.dataModels).toEqual({});
  });
});

describe('@DocumentSheet', () => {
  it('files the sheet under the id it was given, not its class name', () => {
    mock = withMockFoundry();

    @DocumentSheet({
      id: 'character',
      document: 'Actor',
      namespace: 'my-system',
      types: ['character'],
      makeDefault: true,
      label: 'MY.Sheet',
    })
    class CharacterSheet {}

    // Nothing until init: CONFIG may only be touched there.
    expect(mock.sheets).toHaveLength(0);
    mock.callHook('init');

    // This is the key Foundry writes to `flags.core.sheetClass`. It is built
    // from the class name, which a minifier renames between builds, so the
    // decorator goes through `registerSheets`, which pins the name to the id.
    expect(mock.sheets).toHaveLength(1);
    expect(mock.sheets[0]?.key).toBe('my-system.character');
    expect(mock.sheets[0]?.sheetClass).toBe(CharacterSheet);
    expect(mock.sheets[0]?.options).toMatchObject({
      types: ['character'],
      makeDefault: true,
      label: 'MY.Sheet',
    });
  });

  it('passes no types when none are given, which means every type', () => {
    mock = withMockFoundry();

    @DocumentSheet({ id: 'any', document: 'Actor', namespace: 'm' })
    class AnySheet {}
    void AnySheet;

    mock.callHook('init');
    // `types: undefined` is what Foundry reads as "all"; the key must not be
    // an array, or it would mean "none".
    expect(mock.sheets[0]?.options.types).toBeUndefined();
    expect(mock.sheets[0]?.options.makeDefault).toBe(false);
  });

  it('rejects an id it cannot pin, the same way registerSheets does', () => {
    mock = withMockFoundry();

    @DocumentSheet({ id: '', document: 'Actor', namespace: 'm' })
    class Unnamed {}
    void Unnamed;

    expect(() => mock?.callHook('init')).toThrow(VttfError);
  });
});

describe('@OnHook', () => {
  it('subscribes when the class is defined, not at init', () => {
    mock = withMockFoundry();
    const seen: unknown[] = [];

    // @OnHook only accepts static methods, and that is what this case exercises.
    class MyModule {
      @OnHook('renderChatMessageHTML')
      static onRender(message: unknown) {
        seen.push(message);
      }
    }
    void MyModule;

    expect(mock.hooks.map((h) => h.event)).toEqual(['renderChatMessageHTML']);
    mock.callHook('renderChatMessageHTML', 'a message');
    expect(seen).toEqual(['a message']);
  });

  it('refuses an instance method, and says why', () => {
    mock = withMockFoundry();
    expect(() => {
      class Bad {
        @OnHook('ready')
        onReady() {}
      }
      void Bad;
    }).toThrow(VttfError);
  });
});

describe('without a Foundry runtime', () => {
  it('throws VTTF-0002 rather than registering into nothing', () => {
    delete (globalThis as Record<string, unknown>).Hooks;
    expect(() => {
      @ActorDataModel('character')
      class Orphan {}
      void Orphan;
    }).toThrow(VttfError);
  });
});

describe('@SystemSetting', () => {
  it('registers nothing until init fires, then reads and writes through game.settings', async () => {
    mock = withMockFoundry();

    class Settings {
      @SystemSetting({ namespace: 'my-system', scope: 'world', config: true, type: Boolean })
      static accessor homebrew = false;
    }

    expect(mock.settings).toEqual([]);

    mock.callHook('init');
    expect(mock.settings).toEqual([
      {
        namespace: 'my-system',
        key: 'homebrew',
        config: { scope: 'world', config: true, type: Boolean, default: false },
      },
    ]);
    expect(Settings.homebrew).toBe(false);

    Settings.homebrew = true;
    await Promise.resolve();
    expect(Settings.homebrew).toBe(true);
    expect(game.settings.get('my-system', 'homebrew')).toBe(true);
  });

  it('takes an explicit key and default over the accessor name and initializer', () => {
    mock = withMockFoundry();

    class Settings {
      @SystemSetting({
        namespace: 'my-system',
        key: 'difficultyLevel',
        scope: 'client',
        type: String,
        default: 'hard',
      })
      static accessor difficulty = 'normal';
    }

    mock.callHook('init');
    expect(mock.settings[0]).toMatchObject({ key: 'difficultyLevel', config: { default: 'hard' } });
    expect(Settings.difficulty).toBe('hard');
  });

  it('refuses an instance accessor (VTTF-0002)', () => {
    mock = withMockFoundry();

    expect(() => {
      class Settings {
        @SystemSetting({ namespace: 'my-system', scope: 'world', type: Number })
        accessor level = 1;
      }
      void Settings;
    }).toThrow(VttfError);
  });

  it('says so when read before game exists', () => {
    mock = withMockFoundry();

    class Settings {
      @SystemSetting({ namespace: 'my-system', scope: 'world', type: Number })
      static accessor level = 1;
    }

    mock.restore();
    mock = undefined;
    expect(() => Settings.level).toThrow(/VTTF-0002/);
  });
});
