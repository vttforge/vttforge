// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { INJECTION_ATTRIBUTE, inject } from '../inject.js';

let bound: Map<string, Array<{ id: number; fn: (...args: unknown[]) => unknown }>>;
let nextId: number;

beforeEach(() => {
  bound = new Map();
  nextId = 1;
  (globalThis as Record<string, unknown>).Hooks = {
    on: (event: string, fn: (...args: unknown[]) => unknown) => {
      const id = nextId++;
      bound.set(event, [...(bound.get(event) ?? []), { id, fn }]);
      return id;
    },
    off: (event: string, idOrFn: number | ((...args: unknown[]) => unknown)) => {
      const listeners = bound.get(event) ?? [];
      bound.set(
        event,
        listeners.filter((entry) => entry.id !== idOrFn && entry.fn !== idOrFn),
      );
      return true;
    },
  };
});

afterEach(() => {
  (globalThis as Record<string, unknown>).Hooks = undefined;
});

/** Fire a render hook the way Foundry does. */
function render(event: string, app: unknown, element: unknown): void {
  for (const { fn } of bound.get(event) ?? []) fn(app, element);
}

/** A sheet's rendered element, with a header to insert around. */
function sheet(): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = '<header class="directory-header"><h3>Actors</h3></header><ol></ol>';
  return root;
}

function button(label = 'Generate'): HTMLElement {
  const node = document.createElement('button');
  node.textContent = label;
  return node;
}

describe('inserting', () => {
  it('puts the node where it was told, marked with the package and the name', () => {
    inject({
      id: 'my-module',
      name: 'generator',
      hook: 'renderActorDirectory',
      into: '.directory-header',
      position: 'after',
      render: () => button(),
    });

    const element = sheet();
    render('renderActorDirectory', {}, element);

    const inserted = element.querySelector(`[${INJECTION_ATTRIBUTE}]`);
    expect(inserted?.getAttribute(INJECTION_ATTRIBUTE)).toBe('my-module.generator');
    expect(inserted?.previousElementSibling?.className).toBe('directory-header');
  });

  it('replaces its own node on a re-render instead of adding a second', () => {
    let count = 0;
    inject({
      id: 'my-module',
      name: 'generator',
      hook: 'renderActorDirectory',
      render: () => button(`Generate ${++count}`),
    });

    const element = sheet();
    render('renderActorDirectory', {}, element);
    render('renderActorDirectory', {}, element);
    render('renderActorDirectory', {}, element);

    // The failure every module hits: three renders, one button.
    const all = element.querySelectorAll(`[${INJECTION_ATTRIBUTE}]`);
    expect(all).toHaveLength(1);
    expect(all[0]?.textContent).toBe('Generate 3');
  });

  it("leaves another package's injection alone", () => {
    inject({ id: 'mine', name: 'a', hook: 'renderThing', render: () => button('mine') });
    inject({ id: 'theirs', name: 'a', hook: 'renderThing', render: () => button('theirs') });

    const element = sheet();
    render('renderThing', {}, element);
    render('renderThing', {}, element);

    expect(
      [...element.querySelectorAll(`[${INJECTION_ATTRIBUTE}]`)].map((n) => n.textContent),
    ).toEqual(['mine', 'theirs']);
  });

  it('keeps one node when the anchor is the rendered element itself', () => {
    inject({
      id: 'my-module',
      name: 'header',
      hook: 'renderThing',
      position: 'prepend',
      render: () => button(),
    });

    const element = sheet();
    document.body.append(element);
    render('renderThing', {}, element);
    render('renderThing', {}, element);
    render('renderThing', {}, element);

    expect(element.querySelectorAll(`[${INJECTION_ATTRIBUTE}]`)).toHaveLength(1);
    expect(element.firstElementChild?.getAttribute(INJECTION_ATTRIBUTE)).toBe('my-module.header');
    element.remove();
  });

  it('supports every position', () => {
    const positions = ['append', 'prepend', 'before', 'after', 'replace'] as const;
    for (const position of positions) {
      const element = sheet();
      inject({
        id: 'my-module',
        name: position,
        hook: `render_${position}`,
        into: '.directory-header',
        position,
        render: () => button(position),
      });
      render(`render_${position}`, {}, element);
      expect(element.textContent).toContain(position);
    }
    // `replace` takes the anchor's place, so the header is gone.
    const element = sheet();
    inject({
      id: 'my-module',
      name: 'swap',
      hook: 'renderSwap',
      into: '.directory-header',
      position: 'replace',
      render: () => button('swapped'),
    });
    render('renderSwap', {}, element);
    expect(element.querySelector('.directory-header')).toBeNull();
  });
});

describe('not inserting', () => {
  it('skips when `when` says so, and clears what a previous render left', () => {
    let allowed = true;
    inject({
      id: 'my-module',
      name: 'generator',
      hook: 'renderActorDirectory',
      when: () => allowed,
      render: () => button(),
    });

    const element = sheet();
    render('renderActorDirectory', {}, element);
    expect(element.querySelectorAll(`[${INJECTION_ATTRIBUTE}]`)).toHaveLength(1);

    allowed = false;
    render('renderActorDirectory', {}, element);
    expect(element.querySelectorAll(`[${INJECTION_ATTRIBUTE}]`)).toHaveLength(0);
  });

  it('does nothing when the selector finds nothing, or the render returns null', () => {
    inject({
      id: 'my-module',
      name: 'missing',
      hook: 'renderThing',
      into: '.not-here',
      render: () => button(),
    });
    inject({ id: 'my-module', name: 'nothing', hook: 'renderThing', render: () => null });

    const element = sheet();
    expect(() => render('renderThing', {}, element)).not.toThrow();
    expect(element.querySelectorAll(`[${INJECTION_ATTRIBUTE}]`)).toHaveLength(0);
  });

  it('ignores a render that handed over something that is not an element', () => {
    const build = vi.fn(() => button());
    inject({ id: 'my-module', name: 'generator', hook: 'renderThing', render: build });
    render('renderThing', {}, undefined);
    render('renderThing', {}, 'not an element');
    expect(build).not.toHaveBeenCalled();
  });
});

describe('the shapes a hook can hand over', () => {
  it('takes the node out of a jQuery-like object, as the deprecated chat hook passes', () => {
    inject({ id: 'my-module', name: 'stamp', hook: 'renderChatMessage', render: () => button() });

    const element = sheet();
    render('renderChatMessage', {}, { 0: element, length: 1 });

    expect(element.querySelectorAll(`[${INJECTION_ATTRIBUTE}]`)).toHaveLength(1);
  });
});

describe('unbinding', () => {
  it('stops injecting, and the hook is let go', () => {
    const off = inject({
      id: 'my-module',
      name: 'generator',
      hook: 'renderActorDirectory',
      render: () => button(),
    });

    off();
    const element = sheet();
    render('renderActorDirectory', {}, element);
    expect(element.querySelectorAll(`[${INJECTION_ATTRIBUTE}]`)).toHaveLength(0);
    expect(bound.get('renderActorDirectory')).toEqual([]);
  });
});

describe('refusing', () => {
  it('names what is missing', () => {
    const base = { id: 'my-module', name: 'a', hook: 'renderThing', render: () => null };
    expect(() => inject({ ...base, id: '' })).toThrow(/VTTF-0016[\s\S]*package id/);
    expect(() => inject({ ...base, name: '2fast' })).toThrow(/not usable/);
    expect(() => inject({ ...base, hook: '' })).toThrow(/render hook to bind/);
    expect(() => inject({ ...base, render: undefined as never })).toThrow(/render function/);
  });

  it('refuses a position that would put the node outside the application', () => {
    const base = { id: 'my-module', name: 'a', hook: 'renderThing', render: () => null };
    for (const position of ['before', 'after', 'replace'] as const) {
      expect(() => inject({ ...base, position })).toThrow(
        /VTTF-0016[\s\S]*outside the application element/,
      );
    }
    // The same positions are fine once a node is named.
    for (const position of ['before', 'after', 'replace'] as const) {
      expect(() => inject({ ...base, into: '.directory-header', position })).not.toThrow();
    }
  });
});
