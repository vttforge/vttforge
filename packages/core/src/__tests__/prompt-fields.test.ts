// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VttfError } from '../errors/registry.js';
import { type PromptResult, promptFieldGroup, promptFields } from '../prompt-fields.js';

const input = vi.fn(async (_config: Record<string, unknown>) => ({}) as unknown);

function element(tag: string, config: Record<string, unknown>): HTMLElement {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(config)) {
    if (value === undefined) continue;
    el.setAttribute(`data-${key}`, typeof value === 'string' ? value : JSON.stringify(value));
  }
  el.setAttribute('name', String(config.name));
  return el;
}

beforeEach(() => {
  input.mockClear();
  (globalThis as Record<string, unknown>).foundry = {
    applications: {
      fields: {
        createFormGroup: (config: Record<string, unknown>) => {
          const group = document.createElement('div');
          group.className = 'form-group';
          const label = document.createElement('label');
          label.textContent = String(config.label);
          group.append(label, config.input as HTMLElement);
          if (config.hint) {
            const hint = document.createElement('p');
            hint.className = 'hint';
            hint.textContent = String(config.hint);
            group.append(hint);
          }
          return group;
        },
        createTextInput: (c: Record<string, unknown>) => element('input', { ...c, type: 'text' }),
        createTextareaInput: (c: Record<string, unknown>) => element('textarea', c),
        createNumberInput: (c: Record<string, unknown>) =>
          element('input', { ...c, type: 'number' }),
        createCheckboxInput: (c: Record<string, unknown>) =>
          element('input', { ...c, type: 'checkbox' }),
        createSelectInput: (c: Record<string, unknown>) => element('select', c),
      },
      api: { DialogV2: { input } },
    },
  };
  (globalThis as Record<string, unknown>).game = {
    i18n: { localize: (key: string) => (key.startsWith('X.') ? key.slice(2).toUpperCase() : key) },
  };
});

afterEach(() => {
  (globalThis as Record<string, unknown>).foundry = undefined;
  (globalThis as Record<string, unknown>).game = undefined;
});

describe('promptFieldGroup', () => {
  it('builds each type through the Foundry helpers, localized', () => {
    const text = promptFieldGroup({
      name: 'name',
      type: 'text',
      label: 'X.name',
      value: 'Rope',
      hint: 'X.hint',
    });
    expect(text.querySelector('label')?.textContent).toBe('NAME');
    expect(text.querySelector('.hint')?.textContent).toBe('HINT');
    expect(text.querySelector('input')?.getAttribute('data-value')).toBe('Rope');

    const number = promptFieldGroup({
      name: 'qty',
      type: 'number',
      label: 'Qty',
      value: 2,
      min: 1,
    });
    const numberInput = number.querySelector('input');
    expect(numberInput?.getAttribute('data-type')).toBe('number');
    expect(numberInput?.getAttribute('data-min')).toBe('1');
    expect(numberInput?.getAttribute('data-step')).toBe('1');

    const check = promptFieldGroup({ name: 'on', type: 'checkbox', label: 'On' });
    expect(check.querySelector('input')?.getAttribute('data-value')).toBe('false');

    const select = promptFieldGroup({
      name: 'kind',
      type: 'select',
      label: 'Kind',
      value: 'b',
      options: { a: 'X.a', b: 'X.b' },
      blank: 'X.none',
    });
    const selectEl = select.querySelector('select');
    expect(JSON.parse(selectEl?.getAttribute('data-options') ?? '[]')).toEqual([
      { value: 'a', label: 'A' },
      { value: 'b', label: 'B' },
    ]);
    expect(selectEl?.getAttribute('data-blank')).toBe('NONE');

    const listed = promptFieldGroup({
      name: 'kind',
      type: 'select',
      label: 'Kind',
      options: [{ value: 'z', label: 'Zed', group: 'Late' }],
    });
    expect(
      JSON.parse(listed.querySelector('select')?.getAttribute('data-options') ?? '[]'),
    ).toEqual([{ value: 'z', label: 'Zed', group: 'Late' }]);
  });
});

describe('promptFields', () => {
  it('hands DialogV2.input a div of form groups, the title and the button, and returns its answer', async () => {
    input.mockResolvedValueOnce({ name: 'Rope', quantity: 2, stowed: true });
    const answer = await promptFields(
      [
        { name: 'name', type: 'text', label: 'Name' },
        { name: 'quantity', type: 'number', label: 'Quantity', value: 1 },
        { name: 'stowed', type: 'checkbox', label: 'Stowed' },
      ],
      {
        title: 'X.title',
        ok: 'X.ok',
        icon: 'fa-solid fa-plus',
        content: '<p>Intro</p>',
        modal: true,
      },
    );
    expect(answer).toEqual({ name: 'Rope', quantity: 2, stowed: true });
    const config = input.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(config.window).toEqual({ title: 'X.title' });
    expect(config.ok).toEqual({ label: 'X.ok', icon: 'fa-solid fa-plus' });
    expect(config.modal).toBe(true);
    const content = config.content as HTMLElement;
    expect(content.querySelector('p')?.textContent).toBe('Intro');
    expect(content.querySelectorAll('.form-group')).toHaveLength(3);
    expect(content.querySelector('input')?.hasAttribute('autofocus')).toBe(true);
    // Types follow the fields.
    const typed: PromptResult<
      [
        { name: 'name'; type: 'text'; label: 'Name' },
        { name: 'quantity'; type: 'number'; label: 'Q' },
      ]
    > = { name: 'x', quantity: 1 };
    expect(typed.quantity + 1).toBe(2);
  });

  it('resolves null when the dialog is dismissed', async () => {
    input.mockResolvedValueOnce(null);
    expect(await promptFields([{ name: 'a', type: 'text', label: 'A' }])).toBeNull();
    const config = input.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(config.window).toBeUndefined();
    expect(config.ok).toEqual({});
  });

  it('refuses no fields, repeated names, and a missing runtime', async () => {
    await expect(promptFields([])).rejects.toThrow(/at least one field/);
    await expect(
      promptFields([
        { name: 'a', type: 'text', label: 'A' },
        { name: 'a', type: 'number', label: 'B' },
      ]),
    ).rejects.toThrow(/named "a"/);
    (globalThis as Record<string, unknown>).foundry = undefined;
    await expect(promptFields([{ name: 'a', type: 'text', label: 'A' }])).rejects.toThrow(
      VttfError,
    );
  });
});
