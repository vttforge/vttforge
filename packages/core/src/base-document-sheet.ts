/**
 * BaseDocumentSheet — a document sheet that builds its own DOM.
 *
 * `BaseActorSheet` and `BaseItemSheet` are `HandlebarsApplicationMixin`
 * baselines, which is right for the common case: declare `static PARTS`, write
 * templates, let the mixin render them.
 *
 * It is wrong for a sheet whose content is not a template. A canvas, an
 * embedded PDF, a Svelte or Lit mount — those build an element and hand it
 * over. Extending the Handlebars baseline for one of those does not fail
 * loudly; the mixin's `_replaceHTML` expects a map of part id to markup,
 * receives an element instead, and quietly renders nothing. The window opens
 * empty, or does not open at all, and no error names the mismatch.
 *
 * So this is the same document-sheet plumbing without the mixin, with the
 * `_renderHTML` / `_replaceHTML` contract `BaseApplication` provides.
 */

import { VttfError } from './errors/registry.js';
import type { DocumentSheetV2Members, VttforgeClass } from './foundry-base.js';

// biome-ignore lint/suspicious/noExplicitAny: Foundry's sheet shape lives in fvtt-types (deferred to @vttforge/types v1.0)
type AnyConstructor = new (...args: any[]) => any;

interface FoundryApplicationsSheets {
  ActorSheetV2?: AnyConstructor;
  ItemSheetV2?: AnyConstructor;
}

interface FoundryRoot {
  readonly applications?: { readonly sheets?: FoundryApplicationsSheets };
}

/** Which document the sheet is for. */
export type DocumentSheetKind = 'Actor' | 'Item';

/** What `BaseDocumentSheet` adds. */
export interface BaseDocumentSheetMembers {
  /**
   * Put the rendered content in the window.
   *
   * The whole-content swap. Override for a sheet that updates in place —
   * a viewer that keeps its scroll position across a page turn, say.
   */
  _replaceHTML(result: HTMLElement, content: HTMLElement): void;
}

function resolveSheetBase(kind: DocumentSheetKind): AnyConstructor {
  const foundry = (globalThis as Record<string, unknown>).foundry as FoundryRoot | undefined;
  const cls = foundry?.applications?.sheets?.[`${kind}SheetV2`];
  if (typeof cls !== 'function') {
    throw new VttfError(
      'VTTF-0002',
      `foundry.applications.sheets.${kind}SheetV2 is not available. Define your BaseDocumentSheet subclasses inside the Foundry runtime (or stub the global in tests).`,
    );
  }
  return cls;
}

/**
 * Build a document sheet base that renders an element rather than templates.
 *
 * ```ts
 * class PdfActorSheet extends BaseDocumentSheet('Actor') {
 *   async _renderHTML() {
 *     const canvas = document.createElement('canvas');
 *     // …draw the page…
 *     return canvas;
 *   }
 * }
 * ```
 *
 * Reach for `BaseActorSheet` or `BaseItemSheet` instead when the sheet is
 * templates and `static PARTS`, which is most of them.
 */
export function BaseDocumentSheet(
  kind: DocumentSheetKind,
): VttforgeClass<BaseDocumentSheetMembers, unknown, DocumentSheetV2Members> {
  const Base = resolveSheetBase(kind);

  class VttforgeBaseDocumentSheet extends Base {
    // biome-ignore lint/suspicious/noExplicitAny: forwards Foundry's (data, context) pair
    constructor(...args: any[]) {
      super(...args);
      if (typeof (this as { _renderHTML?: unknown })._renderHTML !== 'function') {
        throw new VttfError(
          'VTTF-0002',
          `${this.constructor.name} extends BaseDocumentSheet but does not implement _renderHTML. A sheet that renders no element renders nothing.`,
        );
      }
    }

    _replaceHTML(result: HTMLElement, content: HTMLElement): void {
      content.replaceChildren(result);
    }
  }

  return VttforgeBaseDocumentSheet as unknown as VttforgeClass<
    BaseDocumentSheetMembers,
    unknown,
    DocumentSheetV2Members
  >;
}
