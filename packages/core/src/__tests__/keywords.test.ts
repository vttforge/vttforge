// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VttfError } from '../errors/registry.js';
import {
  assertKeywords,
  KEYWORD_ATTRIBUTE,
  type Keyword,
  keywordEnricher,
  keywordJournalContent,
  syncKeywordJournal,
} from '../keywords.js';

const KEYWORDS: readonly Keyword[] = [
  { id: 'reach', label: 'X.reach', description: 'X.reachHint', category: 'X.combat' },
  { id: 'stowed', label: 'Stowed', description: 'Takes an action to draw.' },
  {
    id: 'light',
    label: 'Light',
    description: 'Sheds light in a 3 m radius.',
    category: 'X.combat',
  },
];

const translations: Record<string, string> = {
  'X.reach': 'Reach',
  'X.reachHint': 'Attacks from 2 m away.',
  'X.combat': 'Combat',
};

beforeEach(() => {
  (globalThis as Record<string, unknown>).game = {
    i18n: { localize: (key: string) => translations[key] ?? key },
    user: { isGM: true },
    system: { id: 'my-system', title: 'My System' },
    modules: { get: (id: string) => (id === 'my-module' ? { title: 'My Module' } : undefined) },
    journal: [],
  };
});

afterEach(() => {
  (globalThis as Record<string, unknown>).game = undefined;
  (globalThis as Record<string, unknown>).CONFIG = undefined;
});

describe('assertKeywords', () => {
  it('refuses a bad id, a repeat, and a missing label or description', () => {
    const bad = (keywords: unknown[]) => () => assertKeywords('my-system', keywords as Keyword[]);
    expect(bad([{ id: 'a.b', label: 'x', description: 'y' }])).toThrow(VttfError);
    expect(bad([{ id: 'a.b', label: 'x', description: 'y' }])).toThrow(/VTTF-0009/);
    expect(
      bad([
        { id: 'a', label: 'x', description: 'y' },
        { id: 'a', label: 'x', description: 'y' },
      ]),
    ).toThrow(/twice/);
    expect(bad([{ id: 'a', label: 'x' }])).toThrow(/string label and a string description/);
    expect(() => assertKeywords('my-system', KEYWORDS)).not.toThrow();
  });
});

describe('keywordEnricher', () => {
  const enrich = async (text: string) => {
    const entry = keywordEnricher(KEYWORDS);
    const match = [...text.matchAll(entry.pattern)][0];
    return match ? await entry.enricher(match) : null;
  };

  it('turns a known id into its translated label with the description as tooltip', async () => {
    const element = (await enrich('Has @Keyword[reach] now')) as HTMLElement;
    expect(element.tagName).toBe('SPAN');
    expect(element.className).toBe('vttf-keyword');
    expect(element.getAttribute(KEYWORD_ATTRIBUTE)).toBe('reach');
    expect(element.textContent).toBe('Reach');
    expect(element.getAttribute('data-tooltip')).toBe('Attacks from 2 m away.');
  });

  it('shows the given text and escapes nothing into markup', async () => {
    const element = (await enrich('@Keyword[stowed]{<b>put away</b>}')) as HTMLElement;
    expect(element.textContent).toBe('<b>put away</b>');
    expect(element.querySelector('b')).toBeNull();
  });

  it('leaves an unknown id to the next package', async () => {
    expect(await enrich('@Keyword[nope]')).toBeNull();
  });

  it('uses the shared enricher id and a global pattern', () => {
    const entry = keywordEnricher(KEYWORDS);
    expect(entry.id).toBe('keyword');
    expect(entry.pattern.global).toBe(true);
  });
});

describe('keywordJournalContent', () => {
  it('groups by translated category, uncategorised first, sorted by label', () => {
    const html = keywordJournalContent(KEYWORDS);
    expect(html).toBe(
      '<dl><dt data-vttforge-keyword="stowed">Stowed</dt><dd>Takes an action to draw.</dd></dl>' +
        '<h2>Combat</h2><dl>' +
        '<dt data-vttforge-keyword="light">Light</dt><dd>Sheds light in a 3 m radius.</dd>' +
        '<dt data-vttforge-keyword="reach">Reach</dt><dd>Attacks from 2 m away.</dd>' +
        '</dl>',
    );
  });

  it('escapes the text it writes', () => {
    const html = keywordJournalContent([{ id: 'x', label: '<i>', description: 'a & b' }]);
    expect(html).toBe('<dl><dt data-vttforge-keyword="x">&lt;i&gt;</dt><dd>a &amp; b</dd></dl>');
  });
});

describe('syncKeywordJournal', () => {
  const create = vi.fn(async (data: Record<string, unknown>) => data);
  beforeEach(() => {
    create.mockClear();
    (globalThis as Record<string, unknown>).CONFIG = {
      JournalEntry: { documentClass: { create } },
    };
  });

  it('does nothing for a player', async () => {
    (globalThis as Record<string, unknown>).game = { user: { isGM: false } };
    expect(await syncKeywordJournal('my-system', KEYWORDS)).toBe('skipped');
    expect(create).not.toHaveBeenCalled();
  });

  it('creates the journal named after the package, flagged under its scope', async () => {
    expect(await syncKeywordJournal('my-system', KEYWORDS)).toBe('created');
    const data = (create.mock.calls[0] as [Record<string, unknown>])[0];
    expect(data.name).toBe('My System keywords');
    expect(data.flags).toEqual({ 'my-system': { vttforge: { keywords: true } } });
    expect(data.pages).toEqual([
      {
        name: 'My System keywords',
        type: 'text',
        text: { content: keywordJournalContent(KEYWORDS), format: 1 },
      },
    ]);
  });

  it('names a module journal after the module, or after what you pass', async () => {
    await syncKeywordJournal('my-module', KEYWORDS);
    expect((create.mock.calls[0] as [{ name: string }])[0].name).toBe('My Module keywords');
    await syncKeywordJournal('my-module', KEYWORDS, 'Glossary');
    expect((create.mock.calls[1] as [{ name: string }])[0].name).toBe('Glossary');
  });

  it('finds its journal by flag and rewrites the page only when the content changed', async () => {
    const update = vi.fn(async () => undefined);
    const journal = {
      id: 'j1',
      name: 'Renamed by the GM',
      flags: { 'my-system': { vttforge: { keywords: true } } },
      pages: [{ id: 'p1', text: { content: keywordJournalContent(KEYWORDS) } }],
      update,
    };
    const other = { id: 'j0', name: 'Other', flags: {}, pages: [], update: vi.fn() };
    (globalThis as { game: { journal: unknown[] } }).game.journal = [other, journal];

    expect(await syncKeywordJournal('my-system', KEYWORDS)).toBe('unchanged');
    expect(update).not.toHaveBeenCalled();

    const more = [...KEYWORDS, { id: 'heavy', label: 'Heavy', description: 'Two hands.' }];
    expect(await syncKeywordJournal('my-system', more)).toBe('updated');
    expect(update).toHaveBeenCalledWith({
      pages: [
        {
          _id: 'p1',
          name: 'My System keywords',
          type: 'text',
          text: { content: keywordJournalContent(more), format: 1 },
        },
      ],
    });
    expect(other.update).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });
});
