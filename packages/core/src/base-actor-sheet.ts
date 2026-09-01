/**
 * BaseActorSheet — `ActorSheetV2 + HandlebarsApplicationMixin` baseline with the
 * boilerplate every shipping system copy-pastes hoisted into the SDK.
 *
 * What this adds beyond stock Foundry v13:
 *
 * - **`static DRAG_DROP`** — declare drag sources / drop targets as data, get
 *   `foundry.applications.ux.DragDrop` instances wired in `_onRender` with
 *   `isEditable`-gated permissions and a sensible default `_onDragStart` that
 *   serialises `data-item-id` elements as `{ type: "Item", uuid }`.
 * - **`_prepareContext` auto-fills `context.tabs[group]`** for every group
 *   declared in ApplicationV2's `static TABS`, so subclass `_prepareContext`
 *   implementations stop having to call `_prepareTabs(group)` by hand.
 * - **Typed drop dispatch** — override `onDropItem(item, event)` /
 *   `onDropActor(actor, event)` / `onDropFolder(folder, event)` /
 *   `onDropActiveEffect(effect, event)` and skip the `fromUuid()` ceremony.
 *   Returning `undefined` falls through to Foundry's default `_onDropX`
 *   behaviour; return any other value to take ownership.
 *
 * Intentional non-additions:
 *
 * - `editImage` action — already shipped by `DocumentSheetV2` (inherited by
 *   `ActorSheetV2`). Templates wire `<img data-edit="img">` and Foundry's
 *   built-in action handles the `FilePicker` flow.
 * - `_getTabs()` — ApplicationV2 already owns the tab state machine; we only
 *   eliminate the `_prepareTabs` call in `_prepareContext`.
 *
 * Resolved lazily so subclasses can be declared at module load without
 * Foundry globals existing yet (test boot, ESM hoist).
 */

import { VttfError } from './errors/registry.js';

// biome-ignore lint/suspicious/noExplicitAny: Foundry's ActorSheetV2 shape lives in fvtt-types (deferred to @vttforge/types v1.0)
type AnyConstructor = new (...args: any[]) => any;

/**
 * Declarative DragDrop entry consumed by `_onRender`. Mirrors the
 * `foundry.applications.ux.DragDrop` constructor config. Permissions and
 * callbacks fall back to sensible defaults that honour `this.isEditable` and
 * the default `_onDragStart` / `_onDrop`.
 */
export interface DragDropConfig {
  readonly dragSelector?: string;
  readonly dropSelector?: string;
  readonly permissions?: {
    readonly dragstart?: () => boolean;
    readonly drop?: () => boolean;
  };
  // biome-ignore lint/suspicious/noExplicitAny: DragEvent payload is browser-native; consumers route to their own typed handlers
  readonly callbacks?: Record<string, (...args: any[]) => unknown>;
}

/**
 * The statics a VTTForge sheet base carries.
 *
 * The factory used to return a bare constructor, so a subclass writing
 * `super.DEFAULT_OPTIONS` — the pattern the docs show and every sheet needs —
 * failed to compile. TypeScript cannot see a static through an untyped
 * constructor. The example system never caught it because it is JavaScript.
 *
 * `DEFAULT_OPTIONS` is deliberately loose: a subclass merges its own shape
 * into it, and pinning ours would reject the merge.
 */
export interface SheetBaseStatics {
  // biome-ignore lint/suspicious/noExplicitAny: a subclass merges arbitrary
  // ApplicationV2 options into this; a narrower type would reject the merge.
  readonly DEFAULT_OPTIONS: Record<string, any>;
  readonly DRAG_DROP: ReadonlyArray<DragDropConfig>;
}

/**
 * What the factory hands back: something you can `extend`, whose statics the
 * compiler can see.
 */
export interface SheetBaseCtor extends SheetBaseStatics {
  // biome-ignore lint/suspicious/noExplicitAny: mirrors ApplicationV2's own
  // constructor arity, which subclasses pass straight through.
  new (...args: any[]): any;
}

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
  ActorSheetV2?: AnyConstructor;
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
  const Base = foundry?.applications?.sheets?.ActorSheetV2;
  const mixin = foundry?.applications?.api?.HandlebarsApplicationMixin;
  if (typeof Base !== 'function' || typeof mixin !== 'function') {
    throw new VttfError(
      'VTTF-0002',
      'foundry.applications.sheets.ActorSheetV2 and/or foundry.applications.api.HandlebarsApplicationMixin are not available. Define your BaseActorSheet subclasses inside the Foundry runtime (or stub the global in tests).',
    );
  }
  return { Base, mixin };
}

function resolveDragDrop(): DragDropCtor | undefined {
  const foundry = (globalThis as Record<string, unknown>).foundry as FoundryGlobal | undefined;
  const ctor = foundry?.applications?.ux?.DragDrop;
  return typeof ctor === 'function' ? ctor : undefined;
}

async function resolveFromUuid(uuid: string): Promise<unknown> {
  const fn = (globalThis as Record<string, unknown>).fromUuid as
    | ((u: string) => Promise<unknown>)
    | undefined;
  if (typeof fn !== 'function') return null;
  return fn(uuid);
}

interface DropPayload {
  readonly type?: string;
  readonly uuid?: string;
}

/**
 * Marker class that consumer CSS uses for scoping. Always present on every
 * VTTForge-derived sheet so rules like `.vttforge .actor-sheet { ... }` work.
 */
export const VTTFORGE_SHEET_CLASS = 'vttforge';

/**
 * Build the `BaseActorSheet` for the current Foundry runtime. See module
 * header for the boilerplate this base eliminates.
 *
 * @example
 * ```ts
 * class CharacterSheet extends BaseActorSheet() {
 *   static DEFAULT_OPTIONS = foundry.utils.mergeObject(
 *     super.DEFAULT_OPTIONS,
 *     { classes: ['my-system'], position: { width: 720 } },
 *   );
 *   static PARTS = { ... };
 *   static TABS = {
 *     primary: {
 *       tabs: [
 *         { id: 'features', group: 'primary', label: 'Features' },
 *         { id: 'inventory', group: 'primary', label: 'Inventory' },
 *       ],
 *       initial: 'features',
 *     },
 *   };
 *   static DRAG_DROP = [{ dragSelector: '.item[draggable=true]', dropSelector: null }];
 *   async onDropItem(item, event) {
 *     if (item.type !== 'weapon') return false;
 *     // …fall through to super by returning undefined.
 *   }
 * }
 * ```
 */
export function BaseActorSheet(): SheetBaseCtor {
  const { Base, mixin } = resolveBases();
  const Mixed = mixin(Base);

  class VttforgeBaseActorSheet extends Mixed {
    static readonly DEFAULT_OPTIONS = {
      classes: [VTTFORGE_SHEET_CLASS],
      window: { resizable: true },
      position: { width: 600, height: 700 },
      tag: 'form',
      form: { submitOnChange: true, closeOnSubmit: false },
      actions: { vttforgeTab: VttforgeBaseActorSheet._onTab },
    } as const;

    /**
     * Declarative DragDrop entries. Each becomes a
     * `foundry.applications.ux.DragDrop` instance bound in `_onRender`.
     * Subclasses override by re-declaring `static DRAG_DROP = [...]`.
     */
    static readonly DRAG_DROP: ReadonlyArray<DragDropConfig> = [];

    /**
     * Augment ApplicationV2's context with `tabs[group]` for sheets that
     * declare **multiple** `static TABS` groups. ApplicationV2 already
     * auto-populates `context.tabs` (keyed by tab id) for single-group
     * sheets — overriding that flat shape would force every consumer to
     * either unwrap or write `context.tabs.<group>.<tabId>` in templates.
     * Multi-group sheets get nested `context.tabs.<group>.<tabId>` because
     * ApplicationV2 returns `{}` for them by default.
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
      return context;
    }

    /**
     * Default `tab` action handler. ApplicationV2 doesn't ship one, so every
     * sheet that uses `<button data-action="tab" data-tab=… data-group=…>`
     * has to wire its own. We toggle the `.active` class on the matching
     * nav element (`[data-action="tab"][data-tab=…][data-group=…]`) and
     * on `section.tab[data-tab=…][data-group=…]`, then update
     * `sheet.tabGroups[group]` so subsequent re-renders pick the right
     * initial tab.
     *
     * ApplicationV2's action dispatcher binds `this` to the sheet instance
     * at call time even though the handler is declared `static`.
     */
    static _onTab(_event: Event, target: HTMLElement): void {
      // biome-ignore lint/complexity/noThisInStatic: ApplicationV2 binds `this` to the sheet instance at call time — wrap the cast in a single line so biome's auto-fix can't rewrite downstream references to the class name
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
        `section.tab[data-group="${group}"]`,
      )) {
        section.classList.toggle('active', section.dataset.tab === tab);
      }
    }

    /**
     * Wire each `static DRAG_DROP` entry into a real `DragDrop` instance.
     * Permissions default to `this.isEditable`; callbacks default to
     * `_onDragStart` / `_onDrop`. Subclasses extending `_onRender` MUST call
     * `super._onRender(context, options)` to keep DragDrop wired.
     */
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

    /**
     * Default drag handler — serialises the item identified by
     * `data-item-id` on the drag source element. Override for richer payloads
     * (Actor drags, custom UUIDs).
     */
    _onDragStart(event: DragEvent): void {
      const target = event.currentTarget as HTMLElement | null;
      const itemId = target?.dataset?.itemId;
      if (!itemId || !event.dataTransfer) return;
      const items = (
        this as { document?: { items?: { get(id: string): { uuid: string } | undefined } } }
      ).document?.items;
      const item = items?.get(itemId);
      if (!item) return;
      event.dataTransfer.setData(
        'application/json',
        JSON.stringify({ type: 'Item', uuid: item.uuid }),
      );
    }

    /**
     * Typed drop sugar. Subclasses override this instead of `_onDropItem`
     * to skip the `fromUuid()` ceremony. Return `undefined` to fall through
     * to Foundry's default `_onDropItem`; return anything else to take
     * ownership of the drop.
     */
    async onDropItem(_item: unknown, _event: DragEvent): Promise<unknown> {
      return undefined;
    }
    async onDropActor(_actor: unknown, _event: DragEvent): Promise<unknown> {
      return undefined;
    }
    async onDropFolder(_folder: unknown, _event: DragEvent): Promise<unknown> {
      return undefined;
    }
    async onDropActiveEffect(_effect: unknown, _event: DragEvent): Promise<unknown> {
      return undefined;
    }

    async _onDropItem(event: DragEvent, data: DropPayload): Promise<unknown> {
      return this.#dispatchDrop('_onDropItem', 'onDropItem', event, data);
    }
    async _onDropActor(event: DragEvent, data: DropPayload): Promise<unknown> {
      return this.#dispatchDrop('_onDropActor', 'onDropActor', event, data);
    }
    async _onDropFolder(event: DragEvent, data: DropPayload): Promise<unknown> {
      return this.#dispatchDrop('_onDropFolder', 'onDropFolder', event, data);
    }
    async _onDropActiveEffect(event: DragEvent, data: DropPayload): Promise<unknown> {
      return this.#dispatchDrop('_onDropActiveEffect', 'onDropActiveEffect', event, data);
    }

    async #dispatchDrop(
      superKey: '_onDropItem' | '_onDropActor' | '_onDropFolder' | '_onDropActiveEffect',
      sugarKey: 'onDropItem' | 'onDropActor' | 'onDropFolder' | 'onDropActiveEffect',
      event: DragEvent,
      data: DropPayload,
    ): Promise<unknown> {
      const uuid = data?.uuid;
      if (uuid) {
        const doc = await resolveFromUuid(uuid);
        if (doc) {
          const result = await (
            this as unknown as Record<
              typeof sugarKey,
              (doc: unknown, event: DragEvent) => Promise<unknown>
            >
          )[sugarKey](doc, event);
          if (result !== undefined) return result;
        }
      }
      const superFn = (Mixed.prototype as Record<typeof superKey, unknown>)[superKey] as
        | ((event: DragEvent, data: DropPayload) => Promise<unknown>)
        | undefined;
      if (typeof superFn === 'function') return superFn.call(this, event, data);
      return undefined;
    }

    #isEditable(): boolean {
      return Boolean((this as { isEditable?: boolean }).isEditable);
    }
  }

  return VttforgeBaseActorSheet as unknown as SheetBaseCtor;
}
