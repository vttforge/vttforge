/**
 * BaseHandlebarsApplication: `ApplicationV2 + HandlebarsApplicationMixin`.
 *
 * `BaseApplication` builds the content itself, which suits a window whose
 * markup comes from code. A window whose markup comes from a template wants
 * the mixin instead, and until now the only bases carrying it were the two
 * document sheets. A standalone templated window, a config screen, a picker,
 * a report, had no typed base and had to reach into the untyped global for
 * the mixin or hand-roll `_renderHTML` around `renderTemplate`.
 *
 * The mixin supplies both halves of the render contract from `static PARTS`,
 * so the trap is different from `BaseApplication`'s. A class with no `PARTS`
 * renders an empty window and says nothing about why. This checks at
 * construction, so it fails where the class is used rather than leaving a
 * blank frame on screen.
 */

import { VttfError } from './errors/registry.js';
import type {
  ApplicationRenderContext,
  ApplicationRenderOptions,
  ApplicationV2Members,
  VttforgeClass,
} from './foundry-base.js';

// biome-ignore lint/suspicious/noExplicitAny: Foundry's ApplicationV2 class is resolved at runtime; the members the SDK stands on are in @vttforge/types
type AnyConstructor = new (...args: any[]) => any;

interface FoundryApplicationsApi {
  ApplicationV2?: AnyConstructor;
  HandlebarsApplicationMixin?: (base: AnyConstructor) => AnyConstructor;
}

interface FoundryRoot {
  readonly applications?: { readonly api?: FoundryApplicationsApi };
}

function resolveBases(): { Base: AnyConstructor; mixin: (b: AnyConstructor) => AnyConstructor } {
  const foundry = (globalThis as Record<string, unknown>).foundry as FoundryRoot | undefined;
  const Base = foundry?.applications?.api?.ApplicationV2;
  const mixin = foundry?.applications?.api?.HandlebarsApplicationMixin;
  if (typeof Base !== 'function' || typeof mixin !== 'function') {
    throw new VttfError(
      'VTTF-0002',
      'foundry.applications.api.ApplicationV2 and/or foundry.applications.api.HandlebarsApplicationMixin are not available. Define your BaseHandlebarsApplication subclasses inside the Foundry runtime (or stub the global in tests).',
    );
  }
  return { Base, mixin };
}

/** What `BaseHandlebarsApplication` adds on top of Foundry's `ApplicationV2`. */
export interface BaseHandlebarsApplicationMembers {
  /**
   * Per-part context, on top of what `_prepareContext` returned.
   *
   * Override it to give one part data the others do not need. The default
   * hands the shared context straight back.
   */
  _preparePartContext(
    partId: string,
    context: ApplicationRenderContext,
    options: ApplicationRenderOptions,
  ): Promise<ApplicationRenderContext>;
}

/**
 * Build the `BaseHandlebarsApplication` for the current Foundry runtime.
 *
 * ```ts
 * class ReportWindow extends BaseHandlebarsApplication() {
 *   static DEFAULT_OPTIONS = {
 *     id: 'my-report',
 *     window: { title: 'MY_MODULE.Report.title' },
 *     position: { width: 560, height: 'auto' },
 *     actions: { refresh: ReportWindow.onRefresh },
 *   };
 *
 *   static PARTS = {
 *     body: { template: 'modules/my-module/templates/report.hbs' },
 *   };
 *
 *   override async _prepareContext() {
 *     return { rows: collectRows() };
 *   }
 * }
 * ```
 *
 * `override` on `_prepareContext` is required, not merely allowed: the factory
 * reports what it adds, so TypeScript sees the member being replaced, and a
 * scaffolded project sets `noImplicitOverride`.
 *
 * Omitting `PARTS` throws when the class is constructed, rather than opening
 * an empty window.
 */
export function BaseHandlebarsApplication(): VttforgeClass<
  BaseHandlebarsApplicationMembers,
  unknown,
  ApplicationV2Members
> {
  const { Base, mixin } = resolveBases();

  class VttforgeBaseHandlebarsApplication extends mixin(Base) {
    // biome-ignore lint/suspicious/noExplicitAny: forwards Foundry's own constructor arity
    constructor(...args: any[]) {
      super(...args);
      const parts = (this.constructor as { PARTS?: Record<string, unknown> }).PARTS;
      if (parts === undefined || Object.keys(parts).length === 0) {
        throw new VttfError(
          'VTTF-0002',
          `${this.constructor.name} extends BaseHandlebarsApplication but declares no static PARTS. The window would render empty.`,
        );
      }
    }
  }

  return VttforgeBaseHandlebarsApplication as unknown as VttforgeClass<
    BaseHandlebarsApplicationMembers,
    unknown,
    ApplicationV2Members
  >;
}
