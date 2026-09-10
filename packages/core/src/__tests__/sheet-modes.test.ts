// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BaseActorSheet } from '../base-actor-sheet.js';
import { BaseItemSheet } from '../base-item-sheet.js';
import { EDIT_IN_PLAY_ATTRIBUTE, MODE_CLASS, TOGGLE_MODE_ACTION } from '../sheet-modes.js';

function stub<T extends object>(instance: T, values: Record<string, unknown>): void {
  Object.assign(instance as Record<string, unknown>, values);
}

class FakeSheetV2 {
  async _prepareContext(_options: unknown): Promise<Record<string, unknown>> {
    return { fromSuper: true };
  }
  async _onRender(_context: unknown, _options: unknown): Promise<void> {
    /* foundry super */
  }
  _getHeaderControls(): Array<{ action?: string; label?: string; icon?: string }> {
    const controls = (
      this.constructor as unknown as { DEFAULT_OPTIONS: { window: { controls: unknown[] } } }
    ).DEFAULT_OPTIONS.window.controls;
    return [...(controls as Array<{ action?: string; label?: string; icon?: string }>)];
  }
}

const HandlebarsApplicationMixin = (base: typeof FakeSheetV2) => class extends base {};

beforeEach(() => {
  (globalThis as Record<string, unknown>).foundry = {
    applications: {
      api: { HandlebarsApplicationMixin },
      sheets: { ActorSheetV2: FakeSheetV2, ItemSheetV2: FakeSheetV2 },
      ux: {},
    },
  };
});

afterEach(() => {
  (globalThis as Record<string, unknown>).foundry = undefined;
});

function sheetElement(): HTMLElement {
  const root = document.createElement('form');
  root.innerHTML = `
    <header class="window-header"><input name="ignored-in-header" /></header>
    <div class="window-content">
      <input name="system.hp" />
      <select name="system.kind"><option>a</option></select>
      <prose-mirror name="system.notes"></prose-mirror>
      <button type="button" data-action="rollAbility">Roll</button>
      <div ${EDIT_IN_PLAY_ATTRIBUTE}><input name="system.hp.value" /></div>
    </div>`;
  return root;
}

describe('a sheet without static MODES', () => {
  it('is always in edit, adds no class and touches no field', async () => {
    class Plain extends BaseActorSheet() {}
    const sheet = new Plain();
    const element = sheetElement();
    stub(sheet, { element, isEditable: true });
    expect(sheet.mode).toBe('edit');
    expect(sheet.isEditMode).toBe(true);
    await sheet._onRender({}, {});
    expect(element.classList.contains(MODE_CLASS.edit)).toBe(false);
    expect(element.querySelector<HTMLInputElement>('input[name="system.hp"]')?.disabled).toBe(
      false,
    );
    const context = await sheet._prepareContext({});
    expect(context).toMatchObject({ mode: 'edit', isEditMode: true, isPlayMode: false });
  });

  it('keeps the header control hidden and toggleMode a no-op', async () => {
    class Plain extends BaseItemSheet() {}
    const sheet = new Plain();
    const render = vi.fn();
    stub(sheet, { isEditable: true, render });
    const control = sheet
      ._getHeaderControls()
      .find((c) => (c as { action?: string }).action === TOGGLE_MODE_ACTION) as
      | { visible: (this: unknown) => boolean }
      | undefined;
    expect(control?.visible.call(sheet)).toBe(false);
    await sheet.toggleMode();
    expect(sheet.mode).toBe('edit');
    expect(render).not.toHaveBeenCalled();
  });
});

describe('a sheet with static MODES', () => {
  // Built inside each test: the globals only exist once beforeEach has run.
  const hero = () =>
    class Hero extends BaseActorSheet() {
      static override readonly MODES = { initial: 'play' as const, labels: { edit: 'X.Edit' } };
    };

  it('opens in the initial mode, exposes it on the context, and disables the fields in play', async () => {
    const Hero = hero();
    const sheet = new Hero();
    const element = sheetElement();
    stub(sheet, { element, isEditable: true });
    expect(sheet.mode).toBe('play');
    expect(sheet.isPlayMode).toBe(true);
    expect(await sheet._prepareContext({})).toMatchObject({ mode: 'play', isPlayMode: true });

    await sheet._onRender({}, {});
    expect(element.classList.contains(MODE_CLASS.play)).toBe(true);
    expect(element.classList.contains(MODE_CLASS.edit)).toBe(false);
    const content = element.querySelector('.window-content') as HTMLElement;
    expect(content.querySelector<HTMLInputElement>('input[name="system.hp"]')?.disabled).toBe(true);
    expect(content.querySelector<HTMLSelectElement>('select')?.disabled).toBe(true);
    expect(content.querySelector('prose-mirror')?.hasAttribute('disabled')).toBe(true);
    // A button is an action, not a field.
    expect(content.querySelector<HTMLButtonElement>('button')?.disabled).toBe(false);
    // The opt-out keeps its field open, and the header is never touched.
    expect(content.querySelector<HTMLInputElement>('input[name="system.hp.value"]')?.disabled).toBe(
      false,
    );
    expect(
      element.querySelector<HTMLInputElement>('input[name="ignored-in-header"]')?.disabled,
    ).toBe(false);
  });

  it('toggles, re-renders, and swaps the control label for where it leads', async () => {
    const Hero = hero();
    const sheet = new Hero();
    const render = vi.fn();
    stub(sheet, { element: sheetElement(), isEditable: true, render });
    const control = () =>
      sheet
        ._getHeaderControls()
        .find((c) => (c as { action?: string }).action === TOGGLE_MODE_ACTION) as {
        label: string;
        icon: string;
        visible: (this: unknown) => boolean;
      };
    expect(control().visible.call(sheet)).toBe(true);
    expect(control().label).toBe('X.Edit');

    await sheet.toggleMode();
    expect(sheet.mode).toBe('edit');
    expect(render).toHaveBeenCalledTimes(1);
    expect(control().label).toBe('Play mode');
    expect(control().icon).toBe('fa-solid fa-dice-d20');

    await sheet._onRender({}, {});
    const element = (sheet as unknown as { element: HTMLElement }).element;
    expect(element.classList.contains(MODE_CLASS.edit)).toBe(true);
    expect(element.querySelector<HTMLInputElement>('input[name="system.hp"]')?.disabled).toBe(
      false,
    );

    await sheet.toggleMode('play');
    expect(sheet.mode).toBe('play');
    stub(sheet, { isEditable: false });
    expect(control().visible.call(sheet)).toBe(false);
  });

  it('dispatches the header control through the action handler', async () => {
    const Hero = hero();
    const sheet = new Hero();
    const render = vi.fn();
    stub(sheet, { element: sheetElement(), isEditable: true, render });
    const handler = (
      Hero.DEFAULT_OPTIONS.actions as unknown as Record<
        string,
        (this: unknown, e: Event, t: HTMLElement) => void
      >
    )[TOGGLE_MODE_ACTION];
    handler?.call(sheet, new Event('click'), document.createElement('button'));
    await Promise.resolve();
    expect(sheet.mode).toBe('edit');
    expect(render).toHaveBeenCalled();
  });
});
