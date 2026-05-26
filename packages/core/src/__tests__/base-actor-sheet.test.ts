// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BaseActorSheet, type DragDropConfig, VTTFORGE_SHEET_CLASS } from '../base-actor-sheet.js';
import { VttfError } from '../errors/registry.js';

class FakeActorSheetV2 {
  async _prepareContext(_options: unknown): Promise<Record<string, unknown>> {
    return { fromSuper: true };
  }
  _onRender(_context: unknown, _options: unknown): void {
    /* foundry super */
  }
  async _onDrop(_event: DragEvent): Promise<void> {
    /* foundry super dispatcher */
  }
  async _onDropItem(_event: DragEvent, _data: { uuid?: string }): Promise<string> {
    return 'super:_onDropItem';
  }
  async _onDropActor(_event: DragEvent, _data: { uuid?: string }): Promise<string> {
    return 'super:_onDropActor';
  }
  async _onDropFolder(_event: DragEvent, _data: { uuid?: string }): Promise<string> {
    return 'super:_onDropFolder';
  }
  async _onDropActiveEffect(_event: DragEvent, _data: { uuid?: string }): Promise<string> {
    return 'super:_onDropActiveEffect';
  }
}

const HandlebarsApplicationMixin = (base: typeof FakeActorSheetV2) =>
  class extends base {
    static readonly _mixed = true;
  };

const dragDropBinds: Array<{ config: Record<string, unknown>; element: HTMLElement }> = [];

class FakeDragDrop {
  constructor(public config: Record<string, unknown>) {}
  bind(element: HTMLElement): void {
    dragDropBinds.push({ config: this.config, element });
  }
}

beforeEach(() => {
  dragDropBinds.length = 0;
  (globalThis as Record<string, unknown>).foundry = {
    applications: {
      sheets: { ActorSheetV2: FakeActorSheetV2 },
      api: { HandlebarsApplicationMixin },
      ux: { DragDrop: FakeDragDrop },
    },
  };
});

afterEach(() => {
  delete (globalThis as Record<string, unknown>).foundry;
  delete (globalThis as Record<string, unknown>).fromUuid;
});

describe('BaseActorSheet — runtime resolution', () => {
  it('throws VTTF-0002 when the required globals are missing', () => {
    delete (globalThis as Record<string, unknown>).foundry;
    expect(() => BaseActorSheet()).toThrow(VttfError);
  });

  it('returns a class that extends ActorSheetV2 via HandlebarsApplicationMixin', () => {
    const Sub = BaseActorSheet();
    const instance = new Sub();
    expect(instance).toBeInstanceOf(FakeActorSheetV2);
    expect((Sub as unknown as { _mixed: boolean })._mixed).toBe(true);
  });
});

describe('BaseActorSheet — DEFAULT_OPTIONS', () => {
  it('always ships the vttforge marker class', () => {
    const Sub = BaseActorSheet();
    const opts = (Sub as unknown as { DEFAULT_OPTIONS: { classes: readonly string[] } })
      .DEFAULT_OPTIONS;
    expect(opts.classes).toContain(VTTFORGE_SHEET_CLASS);
  });

  it('defaults to a submitOnChange form configuration', () => {
    const Sub = BaseActorSheet();
    const opts = (
      Sub as unknown as {
        DEFAULT_OPTIONS: {
          tag: string;
          form: { submitOnChange: boolean; closeOnSubmit: boolean };
          window: { resizable: boolean };
        };
      }
    ).DEFAULT_OPTIONS;
    expect(opts.tag).toBe('form');
    expect(opts.form.submitOnChange).toBe(true);
    expect(opts.form.closeOnSubmit).toBe(false);
    expect(opts.window.resizable).toBe(true);
  });

  it('defaults DRAG_DROP to an empty array', () => {
    const Sub = BaseActorSheet();
    const dragDrop = (Sub as unknown as { DRAG_DROP: readonly unknown[] }).DRAG_DROP;
    expect(dragDrop).toEqual([]);
  });
});

describe('BaseActorSheet — _prepareContext tab auto-population', () => {
  it('calls super._prepareContext and injects context.tabs for every TABS group', async () => {
    const Base = BaseActorSheet();
    const prepareTabs = vi.fn((group: string) => ({ group, active: 'first' }));
    class Sheet extends Base {
      static TABS = {
        primary: { tabs: [{ id: 'first', group: 'primary', label: 'First' }], initial: 'first' },
        secondary: { tabs: [{ id: 'a', group: 'secondary', label: 'A' }], initial: 'a' },
      };
      _prepareTabs = prepareTabs;
    }
    const instance = new Sheet();
    const ctx = (await instance._prepareContext({})) as Record<string, unknown>;
    expect(ctx.fromSuper).toBe(true);
    expect(prepareTabs).toHaveBeenCalledWith('primary');
    expect(prepareTabs).toHaveBeenCalledWith('secondary');
    expect(ctx.tabs).toEqual({
      primary: { group: 'primary', active: 'first' },
      secondary: { group: 'secondary', active: 'first' },
    });
  });

  it('skips tab injection when no TABS are declared', async () => {
    const Base = BaseActorSheet();
    class Sheet extends Base {}
    const instance = new Sheet();
    const ctx = (await instance._prepareContext({})) as Record<string, unknown>;
    expect(ctx.fromSuper).toBe(true);
    expect(ctx.tabs).toBeUndefined();
  });

  it('leaves single-group sheets to ApplicationV2 (no wrap, no _prepareTabs call)', async () => {
    const Base = BaseActorSheet();
    const prepareTabs = vi.fn();
    class Sheet extends Base {
      static TABS = {
        primary: { tabs: [{ id: 'a', group: 'primary', label: 'A' }], initial: 'a' },
      };
      _prepareTabs = prepareTabs;
    }
    const instance = new Sheet();
    const ctx = (await instance._prepareContext({})) as Record<string, unknown>;
    expect(prepareTabs).not.toHaveBeenCalled();
    expect(ctx.tabs).toBeUndefined();
  });
});

describe('BaseActorSheet — default `tab` action', () => {
  it('registers a `vttforgeTab` handler on DEFAULT_OPTIONS.actions', () => {
    const Sub = BaseActorSheet();
    const handler = (Sub as unknown as { DEFAULT_OPTIONS: { actions: { vttforgeTab?: unknown } } })
      .DEFAULT_OPTIONS.actions.vttforgeTab;
    expect(handler).toBeTypeOf('function');
  });

  it('toggles .active on matching nav button and content section, updates tabGroups', () => {
    const Sub = BaseActorSheet();
    const handler = (
      Sub as unknown as {
        DEFAULT_OPTIONS: { actions: { vttforgeTab: (event: Event, target: HTMLElement) => void } };
      }
    ).DEFAULT_OPTIONS.actions.vttforgeTab;
    const root = document.createElement('div');
    root.innerHTML = `
      <nav data-group="primary">
        <button data-action="vttforgeTab" data-tab="a" data-group="primary" class="active"></button>
        <button data-action="vttforgeTab" data-tab="b" data-group="primary"></button>
      </nav>
      <section class="tab" data-tab="a" data-group="primary"></section>
      <section class="tab" data-tab="b" data-group="primary"></section>
    `;
    const sheet = { tabGroups: { primary: 'a' }, element: root };
    const target = root.querySelector('[data-tab="b"]') as HTMLElement;
    handler.call(sheet as unknown as object, new Event('click'), target);
    expect(sheet.tabGroups.primary).toBe('b');
    expect(root.querySelector('[data-tab="a"]')?.classList.contains('active')).toBe(false);
    expect(root.querySelector('[data-tab="b"]')?.classList.contains('active')).toBe(true);
    expect(root.querySelector('section[data-tab="b"]')?.classList.contains('active')).toBe(true);
  });
});

describe('BaseActorSheet — DRAG_DROP wiring in _onRender', () => {
  it('does nothing when DRAG_DROP is empty', () => {
    const Sub = BaseActorSheet();
    const instance = new Sub();
    (instance as { element: HTMLElement }).element = document.createElement('div');
    instance._onRender({}, {});
    expect(dragDropBinds).toHaveLength(0);
  });

  it('binds one DragDrop per static DRAG_DROP entry with default permissions and callbacks', () => {
    const Base = BaseActorSheet();
    class Sheet extends Base {
      static DRAG_DROP: ReadonlyArray<DragDropConfig> = [
        { dragSelector: '.item[draggable]' },
        { dropSelector: '.inventory' },
      ];
    }
    const instance = new Sheet();
    const element = document.createElement('div');
    (instance as { element: HTMLElement }).element = element;
    (instance as { isEditable: boolean }).isEditable = true;
    instance._onRender({}, {});
    expect(dragDropBinds).toHaveLength(2);
    const first = dragDropBinds[0];
    if (!first) throw new Error('expected dragDropBinds[0] after length assertion');
    expect(first.element).toBe(element);
    expect(first.config.dragSelector).toBe('.item[draggable]');
    const perms = first.config.permissions as { dragstart: () => boolean; drop: () => boolean };
    expect(perms.dragstart()).toBe(true);
    expect(perms.drop()).toBe(true);
    const callbacks = first.config.callbacks as Record<string, unknown>;
    expect(typeof callbacks.dragstart).toBe('function');
    expect(typeof callbacks.drop).toBe('function');
  });

  it('honours user-supplied permissions and callbacks (user wins over defaults)', () => {
    const Base = BaseActorSheet();
    const customDrag = vi.fn();
    class Sheet extends Base {
      static DRAG_DROP: ReadonlyArray<DragDropConfig> = [
        {
          dragSelector: '.x',
          permissions: { dragstart: () => false, drop: () => false },
          callbacks: { dragstart: customDrag },
        },
      ];
    }
    const instance = new Sheet();
    (instance as { element: HTMLElement }).element = document.createElement('div');
    (instance as { isEditable: boolean }).isEditable = true;
    instance._onRender({}, {});
    expect(dragDropBinds).toHaveLength(1);
    const entry = dragDropBinds[0];
    if (!entry) throw new Error('expected dragDropBinds[0] after length assertion');
    const perms = entry.config.permissions as { dragstart: () => boolean; drop: () => boolean };
    expect(perms.dragstart()).toBe(false);
    expect(perms.drop()).toBe(false);
    const callbacks = entry.config.callbacks as Record<string, unknown>;
    expect(callbacks.dragstart).toBe(customDrag);
  });

  it('isEditable false locks dragstart and drop', () => {
    const Base = BaseActorSheet();
    class Sheet extends Base {
      static DRAG_DROP: ReadonlyArray<DragDropConfig> = [{ dragSelector: '.item' }];
    }
    const instance = new Sheet();
    (instance as { element: HTMLElement }).element = document.createElement('div');
    (instance as { isEditable: boolean }).isEditable = false;
    instance._onRender({}, {});
    const lockedEntry = dragDropBinds[0];
    if (!lockedEntry) throw new Error('expected dragDropBinds[0]');
    const perms = lockedEntry.config.permissions as {
      dragstart: () => boolean;
      drop: () => boolean;
    };
    expect(perms.dragstart()).toBe(false);
    expect(perms.drop()).toBe(false);
  });
});

describe('BaseActorSheet — default _onDragStart', () => {
  it('serializes the item identified by data-item-id', () => {
    const Sub = BaseActorSheet();
    const instance = new Sub();
    (instance as { document: { items: { get(id: string): { uuid: string } } } }).document = {
      items: { get: (id) => ({ uuid: `Item.${id}` }) },
    };
    const setData = vi.fn();
    const target = document.createElement('li');
    target.dataset.itemId = 'abc';
    const event = {
      currentTarget: target,
      dataTransfer: { setData },
    } as unknown as DragEvent;
    instance._onDragStart(event);
    expect(setData).toHaveBeenCalledWith(
      'application/json',
      JSON.stringify({ type: 'Item', uuid: 'Item.abc' }),
    );
  });

  it('does nothing when the target has no data-item-id', () => {
    const Sub = BaseActorSheet();
    const instance = new Sub();
    const setData = vi.fn();
    const event = {
      currentTarget: document.createElement('div'),
      dataTransfer: { setData },
    } as unknown as DragEvent;
    instance._onDragStart(event);
    expect(setData).not.toHaveBeenCalled();
  });
});

describe('BaseActorSheet — typed drop dispatch', () => {
  function setupFromUuid(uuid: string, doc: unknown): void {
    (globalThis as Record<string, unknown>).fromUuid = vi
      .fn()
      .mockImplementation(async (u: string) => (u === uuid ? doc : null));
  }

  it('routes _onDropItem → onDropItem with the resolved document; returning a value short-circuits super', async () => {
    setupFromUuid('Item.x', { id: 'x', kind: 'item' });
    const Base = BaseActorSheet();
    const onDropItem = vi.fn().mockResolvedValue('subclass-handled');
    class Sheet extends Base {
      onDropItem = onDropItem;
    }
    const instance = new Sheet();
    const event = {} as DragEvent;
    const result = await instance._onDropItem(event, { uuid: 'Item.x' });
    expect(onDropItem).toHaveBeenCalledWith({ id: 'x', kind: 'item' }, event);
    expect(result).toBe('subclass-handled');
  });

  it('falls through to super when the sugar returns undefined', async () => {
    setupFromUuid('Item.y', { id: 'y' });
    const Base = BaseActorSheet();
    class Sheet extends Base {
      onDropItem = vi.fn().mockResolvedValue(undefined);
    }
    const instance = new Sheet();
    const result = await instance._onDropItem({} as DragEvent, { uuid: 'Item.y' });
    expect(result).toBe('super:_onDropItem');
  });

  it('falls through to super when fromUuid resolves to null', async () => {
    setupFromUuid('Item.missing', null);
    const Base = BaseActorSheet();
    class Sheet extends Base {
      onDropItem = vi.fn();
    }
    const instance = new Sheet();
    const result = await instance._onDropItem({} as DragEvent, { uuid: 'Other.id' });
    expect(result).toBe('super:_onDropItem');
  });

  it('dispatches all four document kinds to their typed sugar handlers', async () => {
    (globalThis as Record<string, unknown>).fromUuid = vi.fn(async (u: string) => ({ uuid: u }));
    const Base = BaseActorSheet();
    const onActor = vi.fn().mockResolvedValue('actor-ok');
    const onFolder = vi.fn().mockResolvedValue('folder-ok');
    const onEffect = vi.fn().mockResolvedValue('effect-ok');
    class Sheet extends Base {
      onDropActor = onActor;
      onDropFolder = onFolder;
      onDropActiveEffect = onEffect;
    }
    const instance = new Sheet();
    const evt = {} as DragEvent;
    expect(await instance._onDropActor(evt, { uuid: 'Actor.a' })).toBe('actor-ok');
    expect(await instance._onDropFolder(evt, { uuid: 'Folder.f' })).toBe('folder-ok');
    expect(await instance._onDropActiveEffect(evt, { uuid: 'ActiveEffect.e' })).toBe('effect-ok');
    expect(onActor).toHaveBeenCalledWith({ uuid: 'Actor.a' }, evt);
    expect(onFolder).toHaveBeenCalledWith({ uuid: 'Folder.f' }, evt);
    expect(onEffect).toHaveBeenCalledWith({ uuid: 'ActiveEffect.e' }, evt);
  });
});
