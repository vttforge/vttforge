// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VTTFORGE_SHEET_CLASS } from '../base-actor-sheet.js';
import { BaseItemSheet } from '../base-item-sheet.js';
import { VttfError } from '../errors/registry.js';

class FakeItemSheetV2 {
  async _prepareContext(_options: unknown): Promise<Record<string, unknown>> {
    return { fromSuper: true };
  }
  _onRender(_context: unknown, _options: unknown): void {
    /* foundry super */
  }
}

const HandlebarsApplicationMixin = (base: typeof FakeItemSheetV2) =>
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
      sheets: { ItemSheetV2: FakeItemSheetV2 },
      api: { HandlebarsApplicationMixin },
      ux: { DragDrop: FakeDragDrop },
    },
  };
});

afterEach(() => {
  delete (globalThis as Record<string, unknown>).foundry;
});

describe('BaseItemSheet', () => {
  it('throws VTTF-0002 when the required globals are missing', () => {
    delete (globalThis as Record<string, unknown>).foundry;
    expect(() => BaseItemSheet()).toThrow(VttfError);
  });

  it('returns a class that extends ItemSheetV2 via HandlebarsApplicationMixin', () => {
    const Sub = BaseItemSheet();
    const instance = new Sub();
    expect(instance).toBeInstanceOf(FakeItemSheetV2);
    expect((Sub as unknown as { _mixed: boolean })._mixed).toBe(true);
  });

  it('always ships the vttforge marker class', () => {
    const Sub = BaseItemSheet();
    const opts = (Sub as unknown as { DEFAULT_OPTIONS: { classes: readonly string[] } })
      .DEFAULT_OPTIONS;
    expect(opts.classes).toContain(VTTFORGE_SHEET_CLASS);
  });

  it('defaults to submitOnChange and a narrower position than the actor sheet', () => {
    const Sub = BaseItemSheet();
    const opts = (
      Sub as unknown as {
        DEFAULT_OPTIONS: {
          form: { submitOnChange: boolean; closeOnSubmit: boolean };
          position: { width: number; height: number };
        };
      }
    ).DEFAULT_OPTIONS;
    expect(opts.form.submitOnChange).toBe(true);
    expect(opts.form.closeOnSubmit).toBe(false);
    expect(opts.position.width).toBeLessThan(600);
  });

  it('leaves single-group sheets to ApplicationV2 (no wrap, no _prepareTabs calls)', async () => {
    const Base = BaseItemSheet();
    const prepareTabs = vi.fn((group: string) => ({ group }));
    class Sheet extends Base {
      static TABS = {
        primary: { tabs: [{ id: 'desc', group: 'primary', label: 'Desc' }], initial: 'desc' },
      };
      _prepareTabs = prepareTabs;
    }
    const instance = new Sheet();
    const ctx = (await instance._prepareContext({})) as Record<string, unknown>;
    expect(ctx.fromSuper).toBe(true);
    expect(prepareTabs).not.toHaveBeenCalled();
    expect(ctx.tabs).toBeUndefined();
  });

  it('auto-wraps multi-group TABS so each group is keyed under context.tabs[group]', async () => {
    const Base = BaseItemSheet();
    const prepareTabs = vi.fn((group: string) => ({ group, active: 'first' }));
    class Sheet extends Base {
      static TABS = {
        primary: { tabs: [{ id: 'a', group: 'primary', label: 'A' }], initial: 'a' },
        secondary: { tabs: [{ id: 'b', group: 'secondary', label: 'B' }], initial: 'b' },
      };
      _prepareTabs = prepareTabs;
    }
    const instance = new Sheet();
    const ctx = (await instance._prepareContext({})) as Record<string, unknown>;
    expect(prepareTabs).toHaveBeenCalledWith('primary');
    expect(prepareTabs).toHaveBeenCalledWith('secondary');
    expect(ctx.tabs).toEqual({
      primary: { group: 'primary', active: 'first' },
      secondary: { group: 'secondary', active: 'first' },
    });
  });

  it('registers a default `vttforgeTab` action that swaps .active classes', () => {
    const Base = BaseItemSheet();
    expect(
      (Base as unknown as { DEFAULT_OPTIONS: { actions: { vttforgeTab?: unknown } } })
        .DEFAULT_OPTIONS.actions.vttforgeTab,
    ).toBeTypeOf('function');
  });

  it('binds DragDrop entries declared via static DRAG_DROP', () => {
    const Base = BaseItemSheet();
    class Sheet extends Base {
      static override DRAG_DROP = [{ dragSelector: '.item' }];
    }
    const instance = new Sheet();
    instance.element = document.createElement('div');
    instance.isEditable = true;
    instance._onRender({}, {});
    expect(dragDropBinds).toHaveLength(1);
    const entry = dragDropBinds[0];
    if (!entry) throw new Error('expected dragDropBinds[0] after length assertion');
    const perms = entry.config.permissions as {
      dragstart: () => boolean;
      drop: () => boolean;
    };
    expect(perms.dragstart()).toBe(true);
  });
});
