/**
 * BaseItemSheet — `ItemSheetV2 + HandlebarsApplicationMixin` baseline. Mirror
 * of `BaseActorSheet` minus the typed drop dispatch (items rarely receive
 * drops; the rare case that does can override `_onDrop` directly).
 *
 * Carries the same boilerplate-eliminators:
 *
 * - `static DRAG_DROP` — declarative `foundry.applications.ux.DragDrop` wiring
 *   in `_onRender`, with `isEditable`-gated permissions.
 * - `_prepareContext` auto-fills `context.tabs[group]` for every group declared
 *   in ApplicationV2's `static TABS`.
 *
 * As with `BaseActorSheet`, `editImage` is intentionally not added — it ships
 * built-in on `DocumentSheetV2` (parent of `ItemSheetV2`).
 */

import type { DragDropConfig } from './base-actor-sheet.js';
import { VTTFORGE_SHEET_CLASS } from './base-actor-sheet.js';
import { VttfError } from './errors/registry.js';

// biome-ignore lint/suspicious/noExplicitAny: Foundry's ItemSheetV2 shape lives in fvtt-types (deferred to @vttforge/types v1.0)
type AnyConstructor = new (...args: any[]) => any;

interface DragDropInstance {
  bind(element: HTMLElement): void;
}

interface DragDropCtor {
  new (config: Record<string, unknown>): DragDropInstance;
}

interface FoundryApplicationsApi {
  HandlebarsApplicationMixin?: (base: AnyConstructor) => AnyConstructor;
}

interface FoundryApplicationsSheets {
  ItemSheetV2?: AnyConstructor;
}

interface FoundryApplicationsUx {
  DragDrop?: DragDropCtor;
}

interface FoundryApplications {
  api?: FoundryApplicationsApi;
  sheets?: FoundryApplicationsSheets;
  ux?: FoundryApplicationsUx;
}

interface FoundryGlobal {
  applications?: FoundryApplications;
}

function resolveBases(): { Base: AnyConstructor; mixin: (b: AnyConstructor) => AnyConstructor } {
  const foundry = (globalThis as Record<string, unknown>).foundry as FoundryGlobal | undefined;
  const Base = foundry?.applications?.sheets?.ItemSheetV2;
  const mixin = foundry?.applications?.api?.HandlebarsApplicationMixin;
  if (typeof Base !== 'function' || typeof mixin !== 'function') {
    throw new VttfError(
      'VTTF-0002',
      'foundry.applications.sheets.ItemSheetV2 and/or foundry.applications.api.HandlebarsApplicationMixin are not available. Define your BaseItemSheet subclasses inside the Foundry runtime (or stub the global in tests).',
    );
  }
  return { Base, mixin };
}

function resolveDragDrop(): DragDropCtor | undefined {
  const foundry = (globalThis as Record<string, unknown>).foundry as FoundryGlobal | undefined;
  const ctor = foundry?.applications?.ux?.DragDrop;
  return typeof ctor === 'function' ? ctor : undefined;
}

/**
 * Build the `BaseItemSheet` for the current Foundry runtime.
 *
 * @example
 * ```ts
 * class WeaponSheet extends BaseItemSheet() {
 *   static DEFAULT_OPTIONS = foundry.utils.mergeObject(
 *     super.DEFAULT_OPTIONS,
 *     { classes: ['my-system'], position: { width: 540 } },
 *   );
 *   static PARTS = { ... };
 *   static TABS = {
 *     primary: {
 *       tabs: [
 *         { id: 'description', group: 'primary', label: 'Description' },
 *         { id: 'details', group: 'primary', label: 'Details' },
 *       ],
 *       initial: 'description',
 *     },
 *   };
 * }
 * ```
 */
export function BaseItemSheet(): AnyConstructor {
  const { Base, mixin } = resolveBases();
  const Mixed = mixin(Base);

  class VttforgeBaseItemSheet extends Mixed {
    static readonly DEFAULT_OPTIONS = {
      classes: [VTTFORGE_SHEET_CLASS],
      window: { resizable: true },
      position: { width: 520, height: 480 },
      tag: 'form',
      form: { submitOnChange: true, closeOnSubmit: false },
      actions: {},
    } as const;

    static readonly DRAG_DROP: ReadonlyArray<DragDropConfig> = [];

    async _prepareContext(options: unknown): Promise<Record<string, unknown>> {
      const superPrepare = (
        Mixed.prototype as {
          _prepareContext?: (options: unknown) => Promise<Record<string, unknown>>;
        }
      )._prepareContext;
      const context =
        typeof superPrepare === 'function'
          ? ((await superPrepare.call(this, options)) as Record<string, unknown>)
          : {};
      const tabsConfig = (this.constructor as { TABS?: Record<string, unknown> }).TABS;
      if (tabsConfig && typeof tabsConfig === 'object') {
        const groups = Object.keys(tabsConfig);
        if (groups.length > 0) {
          const prepareTabs = (this as { _prepareTabs?: (group: string) => unknown })._prepareTabs;
          const tabs: Record<string, unknown> = {};
          for (const group of groups) {
            tabs[group] = typeof prepareTabs === 'function' ? prepareTabs.call(this, group) : {};
          }
          context.tabs = tabs;
        }
      }
      return context;
    }

    _onRender(context: unknown, options: unknown): void {
      const superRender = (
        Mixed.prototype as { _onRender?: (context: unknown, options: unknown) => void }
      )._onRender;
      if (typeof superRender === 'function') {
        superRender.call(this, context, options);
      }
      const configs = (this.constructor as { DRAG_DROP?: ReadonlyArray<DragDropConfig> }).DRAG_DROP;
      if (!configs?.length) return;
      const DragDrop = resolveDragDrop();
      if (!DragDrop) return;
      const element = (this as { element?: HTMLElement }).element;
      if (!element) return;
      const onDragStart = (this as { _onDragStart?: (event: DragEvent) => void })._onDragStart;
      const onDrop = (this as { _onDrop?: (event: DragEvent) => void })._onDrop;
      for (const cfg of configs) {
        new DragDrop({
          dragSelector: cfg.dragSelector,
          dropSelector: cfg.dropSelector,
          permissions: {
            dragstart: cfg.permissions?.dragstart ?? (() => this.#isEditable()),
            drop: cfg.permissions?.drop ?? (() => this.#isEditable()),
          },
          callbacks: {
            ...(typeof onDragStart === 'function' ? { dragstart: onDragStart.bind(this) } : {}),
            ...(typeof onDrop === 'function' ? { drop: onDrop.bind(this) } : {}),
            ...(cfg.callbacks ?? {}),
          },
        }).bind(element);
      }
    }

    #isEditable(): boolean {
      return Boolean((this as { isEditable?: boolean }).isEditable);
    }
  }

  return VttforgeBaseItemSheet as unknown as AnyConstructor;
}
