/**
 * BaseItemSheet: `ItemSheetV2 + HandlebarsApplicationMixin` baseline. Mirror
 * of `BaseActorSheet` minus the typed drop dispatch (items rarely receive
 * drops; the rare case that does can override `_onDrop` directly).
 *
 * Carries the same boilerplate-eliminators:
 *
 * - `static DRAG_DROP`: declarative `foundry.applications.ux.DragDrop` wiring
 *   in `_onRender`, with `isEditable`-gated permissions.
 * - `_prepareContext` auto-fills `context.tabs[group]` for every group declared
 *   in ApplicationV2's `static TABS`.
 *
 * As with `BaseActorSheet`, `editImage` is intentionally not added; it ships
 * built-in on `DocumentSheetV2` (parent of `ItemSheetV2`).
 */

import type { DragDropConfig, SheetBaseCtor } from './base-actor-sheet.js';
import { VTTFORGE_SHEET_CLASS } from './base-actor-sheet.js';
import { VttfError } from './errors/registry.js';
import type { ItemLike } from './foundry-base.js';
import {
  applyMode,
  currentMode,
  decorateHeaderControls,
  modeContext,
  type SheetMode,
  toggleMode,
  toggleModeControl,
} from './sheet-modes.js';

// biome-ignore lint/suspicious/noExplicitAny: Foundry's ItemSheetV2 class is resolved at runtime; the members the SDK stands on are in @vttforge/types
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
  // `implementation` is the class a system or module may have swapped in
  // through CONFIG.ux; the bare class is the fallback for a runtime without it.
  const dragDrop = foundry?.applications?.ux?.DragDrop as
    | (DragDropCtor & { implementation?: DragDropCtor })
    | undefined;
  const ctor = dragDrop?.implementation ?? dragDrop;
  return typeof ctor === 'function' ? ctor : undefined;
}

/**
 * Build the `BaseItemSheet` for the current Foundry runtime.
 *
 * @example
 * ```ts
 * class WeaponSheet extends BaseItemSheet() {
 *   static override DEFAULT_OPTIONS = foundry.utils.mergeObject(
 *     super.DEFAULT_OPTIONS,
 *     { classes: ['my-system'], position: { width: 540 } },
 *     { inplace: false }, // never edit the parent's static options in place
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
export function BaseItemSheet<
  TDocument extends ItemLike<unknown> = ItemLike,
>(): SheetBaseCtor<TDocument> {
  const { Base, mixin } = resolveBases();
  const Mixed = mixin(Base);

  class VttforgeBaseItemSheet extends Mixed {
    static readonly DEFAULT_OPTIONS = {
      classes: [VTTFORGE_SHEET_CLASS],
      window: { resizable: true, controls: [toggleModeControl()] },
      position: { width: 520, height: 480 },
      tag: 'form',
      form: { submitOnChange: true, closeOnSubmit: false },
      actions: {
        vttforgeTab: VttforgeBaseItemSheet._onTab,
        vttforgeToggleMode: VttforgeBaseItemSheet._onToggleMode,
      },
    } as const;

    static readonly DRAG_DROP: ReadonlyArray<DragDropConfig> = [];

    /**
     * Multi-group sheets get nested `context.tabs.<group>.<tabId>` because
     * ApplicationV2 returns `{}` for them by default; single-group sheets
     * use ApplicationV2's flat `context.tabs.<tabId>` shape untouched. See
     * BaseActorSheet for the long version.
     */
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
        if (groups.length > 1) {
          const prepareTabs = (this as { _prepareTabs?: (group: string) => unknown })._prepareTabs;
          const tabs: Record<string, unknown> = {};
          for (const group of groups) {
            tabs[group] = typeof prepareTabs === 'function' ? prepareTabs.call(this, group) : {};
          }
          context.tabs = tabs;
        }
      }
      Object.assign(context, modeContext(this));
      return context;
    }

    get mode(): SheetMode {
      return currentMode(this);
    }

    get isEditMode(): boolean {
      return currentMode(this) === 'edit';
    }

    get isPlayMode(): boolean {
      return currentMode(this) === 'play';
    }

    async toggleMode(mode?: SheetMode): Promise<void> {
      await toggleMode(this, mode);
    }

    _getHeaderControls(): unknown[] {
      const superControls = (Mixed.prototype as { _getHeaderControls?: () => unknown[] })
        ._getHeaderControls;
      const controls =
        typeof superControls === 'function' ? (superControls.call(this) as unknown[]) : [];
      return decorateHeaderControls(this, controls as Array<{ action?: string }>);
    }

    static _onToggleMode(_event: Event, _target: HTMLElement): void {
      // biome-ignore lint/complexity/noThisInStatic: ApplicationV2 binds `this` to the sheet instance at call time
      void toggleMode(this as unknown as object);
    }

    static _onTab(_event: Event, target: HTMLElement): void {
      // biome-ignore lint/complexity/noThisInStatic: ApplicationV2 binds `this` to the sheet instance at call time
      const sheet = this as unknown as { tabGroups: Record<string, string>; element?: HTMLElement };
      const group = target.dataset?.group;
      const tab = target.dataset?.tab;
      if (!group || !tab) return;
      sheet.tabGroups[group] = tab;
      const root = sheet.element;
      if (!root) return;
      for (const link of root.querySelectorAll<HTMLElement>(
        `[data-action="vttforgeTab"][data-group="${group}"]`,
      )) {
        link.classList.toggle('active', link.dataset.tab === tab);
      }
      for (const section of root.querySelectorAll<HTMLElement>(
        // Any element with the tab class: a pane is a <section> in the
        // scaffold and a <div> in most systems, and Foundry's own changeTab
        // accepts either.
        `.tab[data-group="${group}"]`,
      )) {
        section.classList.toggle('active', section.dataset.tab === tab);
      }
    }

    async _onRender(context: unknown, options: unknown): Promise<void> {
      // ApplicationV2 renders asynchronously; the parent's work has to finish
      // before the DragDrop instances bind to the element it produced.
      const superRender = (
        Mixed.prototype as {
          _onRender?: (context: unknown, options: unknown) => void | Promise<void>;
        }
      )._onRender;
      if (typeof superRender === 'function') {
        await superRender.call(this, context, options);
      }
      const configs = (this.constructor as { DRAG_DROP?: ReadonlyArray<DragDropConfig> }).DRAG_DROP;
      const DragDrop = resolveDragDrop();
      const element = (this as { element?: HTMLElement }).element;
      if (!configs?.length || !DragDrop || !element) {
        applyMode(this);
        return;
      }
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
      applyMode(this);
    }

    #isEditable(): boolean {
      return Boolean((this as { isEditable?: boolean }).isEditable);
    }
  }

  return VttforgeBaseItemSheet as unknown as SheetBaseCtor<TDocument>;
}
