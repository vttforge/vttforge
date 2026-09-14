/**
 * Hook names infer their arguments, pinned.
 *
 * No parameter here carries an annotation. A name that stops inferring
 * fails the build, which is the only way to notice.
 */
import { describe, expectTypeOf, it } from 'bun:test';
import type {
  ActorLike,
  ChatMessageLike,
  CombatLike,
  HookName,
  HooksApi,
  ItemLike,
} from '../index.js';

declare const Hooks: HooksApi;

describe('document lifecycle hooks', () => {
  it('infers the document from the name', () => {
    Hooks.on('createActor', (actor, options, userId) => {
      expectTypeOf(actor).toExtend<ActorLike>();
      expectTypeOf(options.render).toEqualTypeOf<boolean | undefined>();
      expectTypeOf(userId).toEqualTypeOf<string>();
    });
    Hooks.on('preUpdateItem', (item, changes) => {
      expectTypeOf(item).toExtend<ItemLike>();
      expectTypeOf(changes).toEqualTypeOf<Record<string, unknown>>();
    });
    Hooks.on('deleteActiveEffect', (effect) => {
      expectTypeOf(effect.disabled).toEqualTypeOf<boolean>();
    });
  });
});

describe('named hooks', () => {
  it('infers combat, chat and canvas', () => {
    Hooks.on('combatTurn', (combat, updateData, updateOptions) => {
      expectTypeOf(combat).toExtend<CombatLike>();
      expectTypeOf(updateData.turn).toEqualTypeOf<number>();
      expectTypeOf(updateOptions.direction).toEqualTypeOf<number>();
    });
    Hooks.on('renderChatMessageHTML', (message, html) => {
      expectTypeOf(message).toExtend<ChatMessageLike>();
      expectTypeOf(html).toEqualTypeOf<HTMLElement>();
    });
    Hooks.on('canvasReady', (canvas) => {
      expectTypeOf(canvas.scene?.name).toEqualTypeOf<string | undefined>();
    });
    Hooks.on('hotReload', (data) => {
      expectTypeOf(data.path).toEqualTypeOf<string>();
    });
  });

  it('types each audio channel as a volume', () => {
    Hooks.on('globalPlaylistVolumeChanged', (volume) => {
      expectTypeOf(volume).toEqualTypeOf<number>();
    });
    Hooks.on('globalAmbientVolumeChanged', (volume) => {
      expectTypeOf(volume).toEqualTypeOf<number>();
    });
    Hooks.on('globalInterfaceVolumeChanged', (volume) => {
      expectTypeOf(volume).toEqualTypeOf<number>();
    });
    expectTypeOf(Hooks.callAll<'globalAmbientVolumeChanged'>)
      .parameter(1)
      .toEqualTypeOf<number>();
  });

  it('takes no arguments for the lifecycle pair', () => {
    expectTypeOf(Hooks.once<'init'>)
      .parameter(1)
      .toEqualTypeOf<() => unknown>();
  });
});

describe('the placeable and layer families', () => {
  it('names the document, not the family', () => {
    Hooks.on('drawToken', (token) => {
      expectTypeOf(token.document.name).toEqualTypeOf<string>();
      expectTypeOf(token.isTargeted).toEqualTypeOf<boolean>();
    });
    Hooks.on('controlTile', (tile, controlled) => {
      expectTypeOf(tile.id).toEqualTypeOf<string>();
      expectTypeOf(controlled).toEqualTypeOf<boolean>();
    });
    Hooks.on('hoverWall', (_wall, hovered) => {
      expectTypeOf(hovered).toEqualTypeOf<boolean>();
    });
    Hooks.on('refreshRegion', (region) => {
      expectTypeOf(region.center.x).toEqualTypeOf<number>();
    });
  });

  it('names the layer by its base class', () => {
    Hooks.on('drawTokenLayer', (layer, options) => {
      expectTypeOf(layer.hookName).toEqualTypeOf<string>();
      expectTypeOf(options).toEqualTypeOf<Record<string, unknown>>();
    });
    Hooks.on('activateWallsLayer', (layer) => {
      expectTypeOf(layer.active).toEqualTypeOf<boolean>();
    });
  });

  it('names the group and the effect source too', () => {
    Hooks.on('drawPrimaryCanvasGroup', (group, options) => {
      expectTypeOf(options).toEqualTypeOf<Record<string, unknown>>();
      expectTypeOf(group).toEqualTypeOf<unknown>();
    });
    expectTypeOf<'tearDownEffectsCanvasGroup'>().toExtend<HookName>();
    expectTypeOf<'initializePointLightSourceShaders'>().toExtend<HookName>();
    expectTypeOf<'lightingRefresh'>().toExtend<HookName>();
    expectTypeOf<'rtcSettingsChanged'>().toExtend<HookName>();
  });

  it('has no key for a name Foundry never calls', () => {
    expectTypeOf<'drawObject'>().not.toExtend<HookName>();
    expectTypeOf<'controlObject'>().not.toExtend<HookName>();
    expectTypeOf<'drawLayer'>().not.toExtend<HookName>();
    expectTypeOf<'pastePlaceableObject'>().not.toExtend<HookName>();
    // A layer with no tools is never activated.
    expectTypeOf<'activateGridLayer'>().not.toExtend<HookName>();
    // The one that does fire.
    expectTypeOf<'drawGridLayer'>().toExtend<HookName>();
  });
});

describe('a context menu entry', () => {
  it('takes the v14 names, and still takes the old ones', () => {
    Hooks.on('getActorContextOptions', (_app, entries) => {
      // v14: `label`, `visible`, `onClick`. These are the ones to write.
      entries.push({
        label: 'MY_MODULE.Menu.open',
        icon: 'fa-solid fa-file',
        // Both receive the row the menu was opened on, and `onClick` receives
        // the event before it. A handler that reads the row from the first
        // argument reads an event instead, which is the mistake this pins.
        visible: (target) => target.dataset.entryId !== undefined,
        onClick: (event, target) => {
          expectTypeOf(event).toEqualTypeOf<Event>();
          expectTypeOf(target).toEqualTypeOf<HTMLElement>();
        },
      });
      // v13: still accepted, warns at runtime, removed in v16.
      entries.push({ name: 'Old', condition: true, callback: () => undefined });
    });
  });
});

describe('the open families', () => {
  it("gives a package's own render hook the application shape", () => {
    Hooks.on('renderMyCustomSheet', (app, element) => {
      expectTypeOf(app.title).toEqualTypeOf<string>();
      expectTypeOf(element).toEqualTypeOf<HTMLElement>();
    });
  });

  it('leaves an invented name open', () => {
    expectTypeOf(Hooks.callAll).toBeCallableWith('my-module.thing', 1, 'two');
  });
});
