// @vitest-environment happy-dom
/**
 * BaseApplication exists because of two traps in raw ApplicationV2, and the
 * cases that matter are the ones that prove each trap is gone.
 *
 * Both were met for real while porting a module onto the SDK: a viewer class
 * that declared only `_renderHTML` rendered nothing and reported it as
 * "the class is not renderable", pointing at Foundry rather than at the line
 * that was wrong.
 */
import { afterEach, beforeEach, describe, expect, expectTypeOf, it } from 'vitest';
import { BaseApplication } from '../base-application.js';
import { VttfError } from '../errors/registry.js';

class FakeApplicationV2 {}

beforeEach(() => {
  (globalThis as Record<string, unknown>).foundry = {
    applications: { api: { ApplicationV2: FakeApplicationV2 } },
  };
});

afterEach(() => {
  delete (globalThis as Record<string, unknown>).foundry;
});

describe('BaseApplication', () => {
  it('throws VTTF-0002 when ApplicationV2 is missing', () => {
    delete (globalThis as Record<string, unknown>).foundry;
    expect(() => BaseApplication()).toThrow(VttfError);
  });

  it('ships _replaceHTML, the half that is easy to forget', () => {
    class Window extends BaseApplication() {
      _renderHTML() {
        return document.createElement('div');
      }
    }
    const app = new Window();
    const content = document.createElement('section');
    content.appendChild(document.createElement('span'));

    const rendered = document.createElement('p');
    app._replaceHTML(rendered, content);

    expect([...content.children]).toEqual([rendered]);
  });

  it('lets a subclass replace _replaceHTML for in-place updates', () => {
    class Window extends BaseApplication() {
      _renderHTML() {
        return document.createElement('div');
      }
      // `override` is required, not merely allowed: the factory reports what
      // it adds, so TypeScript can see the member being replaced.
      override _replaceHTML(result: HTMLElement, content: HTMLElement): void {
        content.append(result);
      }
    }
    const app = new Window();
    const content = document.createElement('section');
    const first = document.createElement('p');
    content.appendChild(first);

    app._replaceHTML(document.createElement('p'), content);
    // Appended, not swapped: the original child survives.
    expect(content.children.length).toBe(2);
    expect(content.firstElementChild).toBe(first);
  });

  it('fails at construction when _renderHTML is missing', () => {
    // Foundry reports this on first render, which means a user clicks
    // something and gets an error about abstract methods. Failing here points
    // at the class instead.
    class Broken extends BaseApplication() {}
    expect(() => new Broken()).toThrow(VttfError);
    expect(() => new Broken()).toThrow(/_renderHTML/);
  });

  it('names the offending class in the message', () => {
    class PdfConfig extends BaseApplication() {}
    expect(() => new PdfConfig()).toThrow(/PdfConfig/);
  });
});

describe('what the factory reports', () => {
  it('types the members it adds', () => {
    class Window extends BaseApplication() {
      _renderHTML() {
        return document.createElement('div');
      }
    }
    expectTypeOf<Window['_replaceHTML']>().toEqualTypeOf<
      (result: HTMLElement, content: HTMLElement) => void
    >();
  });

  it('still reaches the Foundry members it does not describe', () => {
    // The Foundry half is typed by @vttforge/types, not here. Until then it
    // has to stay reachable, or every real subclass fails to compile.
    class Window extends BaseApplication() {
      _renderHTML() {
        return document.createElement('div');
      }
      probe(): void {
        void this.element;
        void this.options;
      }
    }
    expect(typeof Window).toBe('function');
  });
});
