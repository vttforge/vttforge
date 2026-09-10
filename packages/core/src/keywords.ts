/**
 * Keywords: the rules terms a system or module defines once and refers to
 * everywhere.
 *
 * A keyword is an id, a label and a description. Registering a list of them
 * through `registerSystem` or `registerModule` gives two things:
 *
 * - An enricher, so `@Keyword[reach]` in any rich text (chat, journals, item
 *   descriptions) becomes the label with the description as its tooltip.
 *   `@Keyword[reach]{Long reach}` picks the text shown.
 * - A journal entry, "<package title> keywords" unless renamed, that lists
 *   every keyword under its category. The GM's client creates it on `ready`
 *   and rewrites it when the list changes, so the world always carries the
 *   glossary the code defines.
 *
 * Labels and descriptions may be localization keys; they are translated when
 * the text is enriched and when the journal is written, both after `i18nInit`.
 *
 * Unknown ids are left alone, so two packages can each register keywords and
 * `@Keyword[...]` resolves against whichever one knows the id.
 */

import { VttfError } from './errors/registry.js';
import type { EnricherRegistration } from './register-enrichers.js';
import { escapeHtml, localize } from './text.js';

export interface Keyword {
  /** One segment of letters, digits and hyphens: what goes in `@Keyword[id]`. */
  readonly id: string;
  /** The text shown, as a localization key or plain text. */
  readonly label: string;
  /** The tooltip and the journal text, as a localization key or plain text. */
  readonly description: string;
  /** Groups the keyword in the journal. Keywords without one come first. */
  readonly category?: string;
}

/** Class on the enriched span; the styles package styles it. */
export const KEYWORD_CLASS = 'vttf-keyword';

/** Attribute on the enriched span carrying the keyword id. */
export const KEYWORD_ATTRIBUTE = 'data-vttforge-keyword';

/** The enricher id, namespaced by `registerEnrichers` to `<package>.keyword`. */
export const KEYWORD_ENRICHER_ID = 'keyword';

const ID_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i;

interface Game {
  i18n?: { localize?: (key: string) => string };
  user?: { isGM?: boolean };
  system?: { id?: string; title?: string };
  modules?: { get?: (id: string) => { title?: string } | undefined };
  journal?: Iterable<JournalLike>;
}

interface PageLike {
  readonly id?: string;
  readonly flags?: Record<string, unknown>;
  readonly text?: { readonly content?: string };
}

interface JournalLike {
  readonly id?: string;
  readonly name?: string;
  readonly flags?: Record<string, unknown>;
  readonly pages?: Iterable<PageLike>;
  updateEmbeddedDocuments(name: string, updates: Record<string, unknown>[]): Promise<unknown>;
  createEmbeddedDocuments(name: string, data: Record<string, unknown>[]): Promise<unknown>;
}

interface JournalClass {
  create(data: Record<string, unknown>): Promise<unknown>;
}

function game(): Game | undefined {
  return (globalThis as Record<string, unknown>).game as Game | undefined;
}

/** Refuse ids that cannot appear in `@Keyword[id]` or repeat within the package. */
export function assertKeywords(packageId: string, keywords: readonly Keyword[]): void {
  const seen = new Set<string>();
  for (const keyword of keywords) {
    if (typeof keyword.id !== 'string' || !ID_PATTERN.test(keyword.id)) {
      throw new VttfError(
        'VTTF-0009',
        `"${String(keyword.id)}" is not a usable keyword id for "${packageId}". Use letters, digits and hyphens; it goes inside @Keyword[...].`,
      );
    }
    if (seen.has(keyword.id)) {
      throw new VttfError(
        'VTTF-0009',
        `"${packageId}" registers the keyword "${keyword.id}" twice. One id, one meaning.`,
      );
    }
    seen.add(keyword.id);
    if (typeof keyword.label !== 'string' || typeof keyword.description !== 'string') {
      throw new VttfError(
        'VTTF-0009',
        `The keyword "${keyword.id}" of "${packageId}" needs a string label and a string description.`,
      );
    }
  }
}

/** The enricher `registerSystem` and `registerModule` register for a keyword list. */
export function keywordEnricher(keywords: readonly Keyword[]): EnricherRegistration {
  const byId = new Map(keywords.map((keyword) => [keyword.id, keyword]));
  return {
    id: KEYWORD_ENRICHER_ID,
    pattern: /@Keyword\[([^\]]+)\](?:\{([^}]+)\})?/g,
    enricher: (match) => {
      const keyword = byId.get(match[1] ?? '');
      // Not ours: leave the text for the next package's enricher.
      if (!keyword) return null;
      const span = document.createElement('span');
      span.className = KEYWORD_CLASS;
      span.setAttribute(KEYWORD_ATTRIBUTE, keyword.id);
      span.setAttribute('data-tooltip', localize(keyword.description));
      span.textContent = match[2] ?? localize(keyword.label);
      return span;
    },
  };
}

/** The HTML of the journal page: one list per category. */
export function keywordJournalContent(keywords: readonly Keyword[]): string {
  const groups = new Map<string, Keyword[]>();
  for (const keyword of keywords) {
    const category = keyword.category === undefined ? '' : localize(keyword.category);
    const list = groups.get(category) ?? [];
    list.push(keyword);
    groups.set(category, list);
  }
  const sections = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  let html = '';
  for (const [category, list] of sections) {
    if (category) html += `<h2>${escapeHtml(category)}</h2>`;
    html += '<dl>';
    for (const keyword of [...list].sort((a, b) =>
      localize(a.label).localeCompare(localize(b.label)),
    )) {
      html += `<dt ${KEYWORD_ATTRIBUTE}="${escapeHtml(keyword.id)}">${escapeHtml(localize(keyword.label))}</dt>`;
      html += `<dd>${escapeHtml(localize(keyword.description))}</dd>`;
    }
    html += '</dl>';
  }
  return html;
}

function packageTitle(packageId: string): string {
  const current = game();
  if (current?.system?.id === packageId) return current.system.title ?? packageId;
  return current?.modules?.get?.(packageId)?.title ?? packageId;
}

/** The journal and its page both carry this; the rest of the journal is the GM's. */
function ourFlags(packageId: string): Record<string, unknown> {
  return { [packageId]: { vttforge: { keywords: true } } };
}

function isOurs(
  document: { readonly flags?: Record<string, unknown> },
  packageId: string,
): boolean {
  const scoped = document.flags?.[packageId] as { vttforge?: { keywords?: unknown } } | undefined;
  return scoped?.vttforge?.keywords === true;
}

/**
 * Create the keywords journal, or rewrite its page when the content changed.
 * Runs on the GM's client only; other clients return at once.
 *
 * The journal and its page are found by a flag under the package's scope, not
 * by name or position, so the GM can rename the journal and add pages of
 * their own; only the flagged page is ever rewritten.
 */
export async function syncKeywordJournal(
  packageId: string,
  keywords: readonly Keyword[],
  name?: string,
): Promise<'created' | 'updated' | 'unchanged' | 'skipped'> {
  const current = game();
  if (!current?.user?.isGM) return 'skipped';
  const content = keywordJournalContent(keywords);
  const pageName = name ?? `${packageTitle(packageId)} keywords`;

  let existing: JournalLike | undefined;
  for (const journal of current.journal ?? []) {
    if (isOurs(journal, packageId)) {
      existing = journal;
      break;
    }
  }

  if (existing) {
    const page = [...(existing.pages ?? [])].find((candidate) => isOurs(candidate, packageId));
    if (page?.text?.content === content) return 'unchanged';
    if (page?.id) {
      await existing.updateEmbeddedDocuments('JournalEntryPage', [
        { _id: page.id, name: pageName, text: { content, format: 1 } },
      ]);
    } else {
      await existing.createEmbeddedDocuments('JournalEntryPage', [
        { name: pageName, type: 'text', text: { content, format: 1 }, flags: ourFlags(packageId) },
      ]);
    }
    return 'updated';
  }

  const config = (globalThis as Record<string, unknown>).CONFIG as
    | { JournalEntry?: { documentClass?: JournalClass } }
    | undefined;
  const JournalEntry = config?.JournalEntry?.documentClass;
  if (!JournalEntry) {
    throw new VttfError(
      'VTTF-0002',
      'CONFIG.JournalEntry.documentClass is not available. The keywords journal is written inside the Foundry runtime only.',
    );
  }
  await JournalEntry.create({
    name: pageName,
    pages: [
      { name: pageName, type: 'text', text: { content, format: 1 }, flags: ourFlags(packageId) },
    ],
    flags: ourFlags(packageId),
  });
  return 'created';
}
