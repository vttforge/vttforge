/**
 * What the Foundry globals hand back, pinned so they cannot narrow again.
 *
 * Each line here was a cast before `@vttforge/types` described `game`, `ui`,
 * `CONFIG`, `CONST` and `foundry.utils`. Asserted on leaves: `expectTypeOf`
 * walks structurally, and these types recurse.
 */
import { describe, expectTypeOf, it } from 'vitest';
import type {
  ActorLike,
  FoundryConfig,
  FoundryConstants,
  FoundryUtils,
  Game,
  RegisteredSetting,
  SettingScope,
  UiApi,
} from '../index.js';

declare const game: Game;
declare const ui: UiApi;
declare const CONFIG: FoundryConfig;
declare const CONST: FoundryConstants;
declare const utils: FoundryUtils;

describe('game', () => {
  it('types the settings round trip', () => {
    expectTypeOf(game.settings.get<number>('my-module', 'schemaVersion')).toEqualTypeOf<number>();
    expectTypeOf(game.settings.register).parameter(0).toEqualTypeOf<string>();
  });

  it('reads the registry of every setting the world declared', () => {
    expectTypeOf(game.settings.settings.size).toEqualTypeOf<number>();
    expectTypeOf(game.settings.settings.get).parameter(0).toEqualTypeOf<string>();
    const entry: RegisteredSetting | undefined =
      game.settings.settings.get('my-module.schemaVersion');
    expectTypeOf(entry?.id).toEqualTypeOf<string | undefined>();
    expectTypeOf(entry?.namespace).toEqualTypeOf<string | undefined>();
    expectTypeOf(entry?.key).toEqualTypeOf<string | undefined>();
    expectTypeOf(entry?.scope).toEqualTypeOf<SettingScope | undefined>();
    // Registration fills both in, so neither is optional on a stored entry.
    expectTypeOf(entry?.default).toEqualTypeOf<unknown>();
  });

  it('types the collections by document', () => {
    expectTypeOf(game.actors.get('x')?.name).toEqualTypeOf<string | undefined>();
    expectTypeOf(game.items.filter(() => true)[0]?.type).toEqualTypeOf<string | undefined>();
    expectTypeOf(game.packs.get('p')?.metadata.label).toEqualTypeOf<string | undefined>();
    expectTypeOf(game.modules.get('m')?.active).toEqualTypeOf<boolean | undefined>();
  });

  it('makes the user nullable, because init has none', () => {
    expectTypeOf(game.user).toEqualTypeOf<ActorLike extends never ? never : Game['user']>();
    expectTypeOf(game.user?.isGM).toEqualTypeOf<boolean | undefined>();
  });

  it('types i18n as returning a string', () => {
    expectTypeOf(game.i18n.localize('A.b')).toEqualTypeOf<string>();
    expectTypeOf(game.i18n.has('A.b')).toEqualTypeOf<boolean>();
  });
});

describe('ui and CONFIG', () => {
  it('types a notification', () => {
    expectTypeOf(ui.notifications.info('x').message).toEqualTypeOf<string>();
  });

  it('types what a package writes in init', () => {
    expectTypeOf(CONFIG.Actor.dataModels).toEqualTypeOf<
      Record<string, FoundryConfig['Actor']['documentClass']>
    >();
    expectTypeOf(CONFIG.Combat.initiative.formula).toEqualTypeOf<string | null>();
    expectTypeOf(CONFIG.statusEffects.burning?.id).toEqualTypeOf<string | undefined>();
  });

  it('types the constants a package reads', () => {
    expectTypeOf(CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER).toEqualTypeOf<number>();
    expectTypeOf(CONST.WORLD_DOCUMENT_TYPES).toEqualTypeOf<readonly string[]>();
  });
});

describe('foundry.utils', () => {
  it('keeps the shape it was handed', () => {
    expectTypeOf(utils.deepClone({ a: 1 })).toEqualTypeOf<{ a: number }>();
    expectTypeOf(utils.getProperty<number>({}, 'a.b')).toEqualTypeOf<number | undefined>();
    expectTypeOf(utils.randomID()).toEqualTypeOf<string>();
    expectTypeOf(utils.isNewerVersion('14', '13')).toEqualTypeOf<boolean>();
    expectTypeOf(utils.flattenObject({})).toEqualTypeOf<Record<string, unknown>>();
  });

  it('gives a debounced function a cancel', () => {
    expectTypeOf(utils.debounce((n: number) => n, 10).cancel).toEqualTypeOf<() => void>();
  });

  it('types the geometry helpers on points', () => {
    expectTypeOf(utils.polygonCentroid([]).x).toEqualTypeOf<number>();
    expectTypeOf(utils.circleCircleIntersects(0, 0, 1, 2, 2, 1)).toEqualTypeOf<boolean>();
  });
});
