// @vitest-environment happy-dom
/**
 * The case this base exists for: a sheet whose content is an element, not a
 * template.
 *
 * Extending the Handlebars baseline for one of those fails quietly — the
 * mixin's `_replaceHTML` takes a map of part id to markup, gets an element,
 * and renders nothing. The window opens empty and nothing names the mismatch.
 * Found by porting a PDF-backed actor sheet onto the SDK.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BaseDocumentSheet } from '../base-document-sheet.js';
import { VttfError } from '../errors/registry.js';

class FakeActorSheetV2 {}
class FakeItemSheetV2 {}

beforeEach(() => {
  (globalThis as Record<string, unknown>).foundry = {
    applications: { sheets: { ActorSheetV2: FakeActorSheetV2, ItemSheetV2: FakeItemSheetV2 } },
  };
});

afterEach(() => {
  delete (globalThis as Record<string, unknown>).foundry;
});

describe('BaseDocumentSheet', () => {
  it('builds on the sheet class for the document kind', () => {
    class ActorPdf extends BaseDocumentSheet('Actor') {
      _renderHTML() {
        return document.createElement('canvas');
      }
    }
    expect(new ActorPdf()).toBeInstanceOf(FakeActorSheetV2);

    class ItemPdf extends BaseDocumentSheet('Item') {
      _renderHTML() {
        return document.createElement('canvas');
      }
    }
    expect(new ItemPdf()).toBeInstanceOf(FakeItemSheetV2);
  });

  it('does not mix in Handlebars, which is the whole point', () => {
    // The mixin would be in the chain if it were applied, and its own
    // _replaceHTML would take a parts map instead of an element.
    class Sheet extends BaseDocumentSheet('Actor') {
      _renderHTML() {
        return document.createElement('canvas');
      }
    }
    const names: string[] = [];
    for (let c = Sheet; c && names.length < 6; c = Object.getPrototypeOf(c)) names.push(c.name);
    expect(names.join(' ')).not.toMatch(/Handlebars/);
  });

  it('swaps the whole content with the element that was rendered', () => {
    class Sheet extends BaseDocumentSheet('Actor') {
      _renderHTML() {
        return document.createElement('canvas');
      }
    }
    const sheet = new Sheet();
    const content = document.createElement('section');
    content.appendChild(document.createElement('span'));

    const rendered = document.createElement('canvas');
    sheet._replaceHTML(rendered, content);

    expect([...content.children]).toEqual([rendered]);
  });

  it('fails at construction when _renderHTML is missing', () => {
    class Empty extends BaseDocumentSheet('Actor') {}
    expect(() => new Empty()).toThrow(VttfError);
    expect(() => new Empty()).toThrow(/_renderHTML/);
  });

  it('throws VTTF-0002 when the sheet class is not there', () => {
    delete (globalThis as Record<string, unknown>).foundry;
    expect(() => BaseDocumentSheet('Actor')).toThrow(VttfError);
  });
});
