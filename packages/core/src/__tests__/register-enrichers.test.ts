/**
 * The four ways `CONFIG.TextEditor.enrichers` accepts an entry and then does
 * nothing with it. All four are silent, and two of them only show up in a
 * world that has some other package installed.
 *
 * Read from the v13 runtime: Foundry wraps enriched output only when both `id`
 * and `onRender` are present, finds the enricher back by id with `find` (first
 * match wins), and matches with `matchAll`, which throws on a non-global
 * regex — outside the handler it wraps enrichers in.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { VttfError } from '../errors/registry.js';
import { type EnricherRegistration, registerEnrichers } from '../register-enrichers.js';

interface Entry {
  id: string;
  pattern: RegExp;
  onRender?: unknown;
  replaceParent?: boolean;
}

let enrichers: Entry[];

const link = (over: Partial<EnricherRegistration> = {}): EnricherRegistration => ({
  id: 'link',
  pattern: /@PDF\[(.+?)\]/g,
  enricher: () => document.createElement('a'),
  ...over,
});

beforeEach(() => {
  enrichers = [];
  (globalThis as Record<string, unknown>).CONFIG = { TextEditor: { enrichers } };
});

afterEach(() => {
  delete (globalThis as Record<string, unknown>).CONFIG;
});

describe('registerEnrichers', () => {
  it('namespaces the id, so a common name cannot collide with another package', () => {
    registerEnrichers('pdf-character-sheet', [link()]);
    expect(enrichers[0]?.id).toBe('pdf-character-sheet.link');
  });

  it('keeps the pattern, onRender and replaceParent as given', () => {
    const pattern = /@PDF\[(.+?)\]/g;
    const onRender = () => undefined;
    registerEnrichers('my-module', [link({ pattern, onRender, replaceParent: true })]);
    expect(enrichers[0]?.pattern).toBe(pattern);
    expect(enrichers[0]?.onRender).toBe(onRender);
    expect(enrichers[0]?.replaceParent).toBe(true);
  });

  it('always supplies an id, which is what makes onRender fire at all', () => {
    // Foundry wraps enriched output only when id and onRender are both there,
    // and only the wrapper fires onRender.
    registerEnrichers('my-module', [link({ onRender: () => undefined })]);
    expect(enrichers[0]?.id).toBeTruthy();
  });

  it('appends rather than replacing what is already registered', () => {
    enrichers.push({ id: 'core.link', pattern: /x/g });
    registerEnrichers('my-module', [link()]);
    expect(enrichers.map((e) => e.id)).toEqual(['core.link', 'my-module.link']);
  });

  it('refuses a pattern without the g flag, which would throw mid-render', () => {
    expect(() => registerEnrichers('my-module', [link({ pattern: /@PDF/ })])).toThrow(VttfError);
  });

  it('refuses a dotted id', () => {
    expect(() => registerEnrichers('my-module', [link({ id: 'nested.link' })])).toThrow(VttfError);
  });

  it('refuses an empty id', () => {
    expect(() => registerEnrichers('my-module', [link({ id: '' })])).toThrow(VttfError);
  });

  it('refuses two enrichers with the same id, where the second would lose', () => {
    expect(() =>
      registerEnrichers('my-module', [link(), link({ onRender: () => undefined })]),
    ).toThrow(VttfError);
  });

  it('registers nothing when one entry is bad, rather than half the list', () => {
    expect(() =>
      registerEnrichers('my-module', [link(), link({ id: 'other', pattern: /x/ })]),
    ).toThrow(VttfError);
    expect(enrichers).toHaveLength(0);
  });

  it('says so when Foundry is not there', () => {
    delete (globalThis as Record<string, unknown>).CONFIG;
    expect(() => registerEnrichers('my-module', [link()])).toThrow(VttfError);
  });
});
