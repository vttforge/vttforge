/**
 * Text enricher registration.
 *
 * An enricher turns a pattern in any rich text field (chat, journals, item
 * descriptions) into markup. `@PDF[handbook|page=12]{Player's Handbook}`
 * becomes a link that opens the book at that page.
 *
 * `CONFIG.TextEditor.enrichers` is a plain array, so registering by hand is one
 * `push`. The reason this exists is that the array has four ways to accept an
 * entry and then do nothing with it, and Foundry names none of them:
 *
 * - **`onRender` without `id` never fires.** Foundry wraps enriched output in a
 *   custom element only when both are present; without the wrapper there is
 *   nothing to fire the callback from. The enricher still produces markup, so
 *   the text looks right and only the behaviour is missing.
 * - **A duplicate `id` silently loses.** The wrapper stores the id as an
 *   attribute and looks the enricher back up with `find`; first match wins.
 *   Two packages using `link` means the first one's `onRender` runs against the
 *   second one's markup. Only reproducible with both installed.
 * - **A pattern without the `g` flag throws.** Enrichment runs the pattern
 *   through `matchAll`, which rejects a non-global regex, and that throw is
 *   outside the handler Foundry wraps enrichers in.
 * - **The same id can collide with a system or another module**, because the
 *   id lives in one flat namespace shared by everything installed.
 *
 * So ids are namespaced the way `moduleSubType` namespaces document types, and
 * the rest is checked when you register rather than when someone opens a chat
 * message.
 */

import { VttfError } from './errors/registry.js';

/** The enriched element Foundry hands to `onRender`. */
export interface EnricherRegistration {
  /**
   * Name for this enricher, unique within the package.
   *
   * Registered as `<package id>.<id>`. Foundry keeps every enricher in one
   * namespace, so the prefix is what stops a `link` from colliding with the
   * `link` of whatever else the world has installed.
   */
  readonly id: string;

  /**
   * The pattern to match. Must carry the `g` flag: enrichment runs it through
   * `matchAll`, which refuses a non-global regex.
   */
  readonly pattern: RegExp;

  /**
   * Build the replacement for one match. Return `null` to leave the text
   * alone, the usual answer when the thing referenced does not exist or the
   * reader is not allowed to see it.
   */
  readonly enricher: (
    match: RegExpMatchArray,
    options?: unknown,
  ) => Promise<HTMLElement | null> | HTMLElement | null;

  /**
   * Runs when enriched content enters the DOM. The place to bind listeners:
   * it fires on every render, so the markup and its behaviour stay declared
   * together instead of in a separate hook.
   */
  readonly onRender?: (element: HTMLElement) => void;

  /** Replace the whole parent element rather than just the matched text. */
  readonly replaceParent?: boolean;
}

interface FoundryEnricherEntry {
  id: string;
  pattern: RegExp;
  enricher: EnricherRegistration['enricher'];
  onRender?: EnricherRegistration['onRender'];
  replaceParent?: boolean;
}

interface TextEditorConfig {
  enrichers?: FoundryEnricherEntry[];
}

interface ConfigWithTextEditor {
  TextEditor?: TextEditorConfig;
}

/** Ids are one segment: Foundry joins the package id and this with a dot. */
const ID_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i;

function assertValidId(id: string, packageId: string): void {
  if (!ID_PATTERN.test(id)) {
    throw new VttfError(
      'VTTF-0007',
      `"${id}" is not a usable enricher id for "${packageId}". Use letters, digits and hyphens, no dots. The package id and the enricher id are joined with one.`,
    );
  }
}

function assertGlobalPattern(entry: EnricherRegistration, packageId: string): void {
  if (!entry.pattern.global) {
    throw new VttfError(
      'VTTF-0007',
      `The pattern for enricher "${packageId}.${entry.id}" is missing the g flag. Enrichment matches with matchAll, which throws on a non-global regex. And it throws while rendering someone's chat message, not here.`,
    );
  }
}

function readEnrichers(): FoundryEnricherEntry[] {
  const config = (globalThis as Record<string, unknown>).CONFIG as ConfigWithTextEditor | undefined;
  const enrichers = config?.TextEditor?.enrichers;
  if (!Array.isArray(enrichers)) {
    throw new VttfError(
      'VTTF-0002',
      'CONFIG.TextEditor.enrichers is not available. Register enrichers inside the Foundry runtime, or stub CONFIG in tests.',
    );
  }
  return enrichers;
}

/**
 * Register a package's text enrichers under namespaced ids.
 *
 * Called for you by `registerSystem` and `registerModule`; exported for a
 * package that registers enrichers outside either.
 */
export function registerEnrichers(
  packageId: string,
  enrichers: readonly EnricherRegistration[],
): void {
  const seen = new Set<string>();
  for (const entry of enrichers) {
    assertValidId(entry.id, packageId);
    assertGlobalPattern(entry, packageId);
    if (seen.has(entry.id)) {
      throw new VttfError(
        'VTTF-0007',
        `"${packageId}" registers two enrichers with the id "${entry.id}". Foundry looks an enricher up by id and takes the first match, so the second one's onRender would never run.`,
      );
    }
    seen.add(entry.id);
  }

  const registry = readEnrichers();
  for (const entry of enrichers) {
    registry.push({
      id: `${packageId}.${entry.id}`,
      pattern: entry.pattern,
      enricher: entry.enricher,
      onRender: entry.onRender,
      replaceParent: entry.replaceParent,
    });
  }
}
