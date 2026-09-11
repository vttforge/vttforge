/**
 * Putting your own UI inside someone else's application.
 *
 * This is most of what a module does. There is no API for it: you bind
 * `renderThatApplication`, find a node, and insert. Foundry re-renders that
 * application whenever its document changes, so the code runs again and
 * again, and the three things that go wrong are always the same:
 *
 * - **The insert repeats.** A render is not a fresh document, so the second
 *   render finds the first insertion still there and adds another beside it.
 *   Every module solves this by hand, usually with an id and a lookup.
 * - **The hook may hand over jQuery.** Most render hooks pass an
 *   `HTMLElement` since v13, but the deprecated `renderChatMessage` passes a
 *   jQuery object, and code written against one breaks on the other.
 * - **Nothing is unbound.** A module that stops needing its injection leaves
 *   the hook bound for the rest of the session.
 *
 * `inject()` marks what it inserted with the package id, removes the previous
 * one before inserting again, normalises the element, and hands back a
 * function that unbinds.
 *
 * It does not patch anything. Adding to an application that offers no seam at
 * all is a different problem, and wrapping someone else's method to solve it
 * belongs to `libWrapper`, not here.
 */

import { VttfError } from './errors/registry.js';
import type { HooksApi } from './foundry-globals.js';

/** Marks a node this package inserted, so the next render can replace it. */
export const INJECTION_ATTRIBUTE = 'data-vttforge-injection';

/** Where the new node goes, relative to the one found by `into`. */
export type InjectPosition = 'append' | 'prepend' | 'before' | 'after' | 'replace';

export interface InjectOptions<App = unknown> {
  /** Package id. Namespaces the marker, so two packages cannot fight. */
  readonly id: string;
  /**
   * Name for this injection, unique within the package. It is half the
   * marker, and what a second render looks for before inserting again.
   */
  readonly name: string;
  /**
   * The render hook, such as `renderActorDirectory` or `renderActorSheetV2`.
   * Render hooks fire once per class in the chain, so the base class name
   * catches every sheet and the exact class name catches one.
   */
  readonly hook: string;
  /**
   * CSS selector for the node to insert around, searched inside the rendered
   * element. Left out, the rendered element itself is used, and `position` is
   * then limited to `'append'` and `'prepend'`.
   */
  readonly into?: string;
  /**
   * Default `'append'`. `'before'`, `'after'` and `'replace'` need `into`:
   * without it they would put the node outside the application.
   */
  readonly position?: InjectPosition;
  /** Skip the injection entirely when this returns false. */
  readonly when?: (app: App, element: HTMLElement) => boolean;
  /**
   * Build what to insert. Return `null` to insert nothing, which still
   * removes anything a previous render left.
   */
  readonly render: (app: App, element: HTMLElement) => HTMLElement | null;
}

function hooks(): HooksApi {
  const api = (globalThis as { Hooks?: HooksApi }).Hooks;
  if (api === undefined || typeof api.on !== 'function') {
    throw new VttfError(
      'VTTF-0002',
      'globalThis.Hooks is not available. Call inject() inside a Foundry runtime or stub Hooks in tests',
    );
  }
  return api;
}

/**
 * The rendered element, whichever way the hook passed it.
 *
 * Most render hooks pass an `HTMLElement`. The deprecated `renderChatMessage`
 * passes jQuery, which is array-like, so the first entry is the node.
 */
function elementOf(value: unknown): HTMLElement | undefined {
  if (value && typeof value === 'object' && 'querySelector' in value) {
    return value as HTMLElement;
  }
  const first = (value as { 0?: unknown } | undefined)?.[0];
  if (first && typeof first === 'object' && 'querySelector' in first) {
    return first as HTMLElement;
  }
  return undefined;
}

function place(anchor: HTMLElement, node: HTMLElement, position: InjectPosition): void {
  if (position === 'append') anchor.append(node);
  else if (position === 'prepend') anchor.prepend(node);
  else if (position === 'before') anchor.before(node);
  else if (position === 'after') anchor.after(node);
  else anchor.replaceWith(node);
}

/**
 * Insert something of your own every time an application renders.
 *
 * Returns a function that unbinds the hook. Call it when the feature is
 * switched off; leaving it bound means the injection comes back the next time
 * that application renders.
 */
export function inject<App = unknown>(options: InjectOptions<App>): () => void {
  const { id, name, hook } = options;
  if (typeof id !== 'string' || id === '') {
    throw new VttfError('VTTF-0016', 'inject() needs the package id.');
  }
  if (typeof name !== 'string' || !/^[A-Za-z][A-Za-z0-9_-]*$/.test(name)) {
    throw new VttfError(
      'VTTF-0016',
      `inject() name ${JSON.stringify(name)} is not usable. Names start with a letter and hold letters, digits, hyphens and underscores.`,
    );
  }
  if (typeof hook !== 'string' || hook === '') {
    throw new VttfError('VTTF-0016', `inject() for "${id}.${name}" needs a render hook to bind.`);
  }
  if (typeof options.render !== 'function') {
    throw new VttfError('VTTF-0016', `inject() for "${id}.${name}" needs a render function.`);
  }

  const marker = `${id}.${name}`;
  const position = options.position ?? 'append';

  // Without `into` the anchor is the application's own element, and these
  // three put the node outside it: `replace` takes the whole application
  // away, `before` and `after` drop the node next to the window, where the
  // next render cannot find it again and inserts a second one. Name the node
  // to work around instead.
  if (options.into === undefined && position !== 'append' && position !== 'prepend') {
    throw new VttfError(
      'VTTF-0016',
      `inject() for "${marker}" asked for "${position}" with no "into" selector. That puts the node outside the application element. Use "append" or "prepend", or name a node with "into".`,
    );
  }

  const listener = (app: unknown, rendered: unknown): void => {
    const element = elementOf(rendered);
    if (!element) return;

    // Whatever the last render left, removed first, so a re-render replaces
    // rather than stacks and a `render` that now returns null cleans up. The
    // search covers the rendered element, which is where every allowed
    // position puts the node.
    for (const stale of element.querySelectorAll(`[${INJECTION_ATTRIBUTE}="${marker}"]`)) {
      stale.remove();
    }

    if (options.when && !options.when(app as App, element)) return;

    const anchor = options.into ? element.querySelector<HTMLElement>(options.into) : element;
    // The selector found nothing. The application changed its markup, or this
    // render is a different class in the same chain.
    if (!anchor) return;

    const node = options.render(app as App, element);
    if (!node) return;
    node.setAttribute(INJECTION_ATTRIBUTE, marker);
    place(anchor, node, position);
  };

  const handle = hooks().on(hook, listener);
  return () => {
    hooks().off(hook, handle);
  };
}
