/**
 * BaseApplication — a plain `ApplicationV2` window, minus the two traps.
 *
 * The document sheets are covered by `BaseActorSheet` and `BaseItemSheet`.
 * Everything else a package puts on screen — a config dialog, a picker, a
 * reader window — is a bare `ApplicationV2`, and writing one by hand means
 * meeting both of these:
 *
 * **`_replaceHTML` is easy to forget.** ApplicationV2 splits rendering in two:
 * `_renderHTML` builds the content and `_replaceHTML` puts it in the window.
 * Implement only the first and the class is silently unrenderable — Foundry
 * says so at the moment something tries to open it, not when it is defined.
 * Nearly every implementation of the second is the same line, so this ships
 * it. Override it when the window updates in place instead of wholesale.
 *
 * **A missing `_renderHTML` fails late.** Foundry's own check fires on first
 * render, which in practice means a user clicks something and gets an error
 * about abstract methods. This checks at construction, so it fails where the
 * class is used rather than deep inside a render.
 */

import { VttfError } from './errors/registry.js';
import type { VttforgeClass } from './foundry-base.js';

// biome-ignore lint/suspicious/noExplicitAny: Foundry's ApplicationV2 shape lives in fvtt-types (deferred to @vttforge/types v1.0)
type AnyConstructor = new (...args: any[]) => any;

interface FoundryApplicationsApi {
  ApplicationV2?: AnyConstructor;
}

interface FoundryRoot {
  readonly applications?: { readonly api?: FoundryApplicationsApi };
}

function resolveApplicationV2(): AnyConstructor {
  const foundry = (globalThis as Record<string, unknown>).foundry as FoundryRoot | undefined;
  const cls = foundry?.applications?.api?.ApplicationV2;
  if (typeof cls !== 'function') {
    throw new VttfError(
      'VTTF-0002',
      'foundry.applications.api.ApplicationV2 is not available. Define your BaseApplication subclasses inside the Foundry runtime (or stub the global in tests).',
    );
  }
  return cls;
}

/**
 * Build an `ApplicationV2` base with the rendering contract filled in.
 *
 * ```ts
 * class PdfConfig extends BaseApplication() {
 *   async _renderHTML() {
 *     const form = document.createElement('form');
 *     // …
 *     return form;
 *   }
 * }
 * ```
 *
 * `_replaceHTML` is provided. `_renderHTML` is yours, and omitting it throws
 * when the class is constructed rather than when someone opens the window.
 */
/** What `BaseApplication` adds on top of Foundry's `ApplicationV2`. */
export interface BaseApplicationMembers {
  /**
   * Put the rendered content in the window.
   *
   * Provided because it is the half people forget. Override it for a window
   * that updates in place rather than swapping its whole content.
   */
  _replaceHTML(result: HTMLElement, content: HTMLElement): void;
}

export function BaseApplication(): VttforgeClass<BaseApplicationMembers> {
  const Base = resolveApplicationV2();

  class VttforgeBaseApplication extends Base {
    // biome-ignore lint/suspicious/noExplicitAny: forwards Foundry's own constructor arity
    constructor(...args: any[]) {
      super(...args);
      if (typeof (this as { _renderHTML?: unknown })._renderHTML !== 'function') {
        throw new VttfError(
          'VTTF-0002',
          `${this.constructor.name} extends BaseApplication but does not implement _renderHTML. ApplicationV2 cannot render without it.`,
        );
      }
    }

    /**
     * Put the rendered content in the window.
     *
     * The whole-content swap, which is what almost every window wants.
     * Override to update in place — a viewer that keeps scroll position
     * across a page turn, say.
     */
    _replaceHTML(result: HTMLElement, content: HTMLElement): void {
      content.replaceChildren(result);
    }
  }

  return VttforgeBaseApplication as unknown as VttforgeClass<BaseApplicationMembers>;
}
