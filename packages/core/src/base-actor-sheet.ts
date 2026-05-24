/**
 * BaseActorSheet — minimal `ActorSheetV2 + HandlebarsApplicationMixin` baseline.
 *
 * v0.1 surface intentionally small:
 *
 * - Resolves `foundry.applications.sheets.ActorSheetV2` and
 *   `foundry.applications.api.HandlebarsApplicationMixin` from globalThis.
 * - Ships a `DEFAULT_OPTIONS` template subclasses merge into, including the
 *   `vttforge` marker class so consumer CSS can scope safely (per
 *   foundry-vtt-system-dev §"Styling & Themes" rule #2).
 * - DragDrop wiring, _getTabs elimination, image picker — all v0.1-close, not
 *   foundation.
 *
 * Resolved lazily so subclasses can be declared at module load without
 * Foundry globals existing yet (test boot, ESM hoist).
 */

import { VttfError } from './errors/registry.js';

// biome-ignore lint/suspicious/noExplicitAny: Foundry's ActorSheetV2 shape lives in fvtt-types (deferred to @vttforge/types v1.0)
type AnyConstructor = new (...args: any[]) => any;

interface FoundryApplicationsApi {
  HandlebarsApplicationMixin?: (base: AnyConstructor) => AnyConstructor;
}

interface FoundryApplicationsSheets {
  ActorSheetV2?: AnyConstructor;
}

interface FoundryApplications {
  api?: FoundryApplicationsApi;
  sheets?: FoundryApplicationsSheets;
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

/**
 * Marker class that consumer CSS uses for scoping. Always present on every
 * VTTForge-derived sheet so rules like `.vttforge .actor-sheet { ... }` work.
 */
export const VTTFORGE_SHEET_CLASS = 'vttforge';

/**
 * Build the `BaseActorSheet` for the current Foundry runtime.
 *
 * Subclasses look like:
 *
 *   class CharacterSheet extends BaseActorSheet() {
 *     static DEFAULT_OPTIONS = foundry.utils.mergeObject(
 *       super.DEFAULT_OPTIONS,
 *       { classes: ['my-system'], position: { width: 720 } }
 *     );
 *     static PARTS = { ... };
 *   }
 */
export function BaseActorSheet(): AnyConstructor {
  const { Base, mixin } = resolveBases();
  const Mixed = mixin(Base);

  class VttforgeBaseActorSheet extends Mixed {
    static readonly DEFAULT_OPTIONS = {
      classes: [VTTFORGE_SHEET_CLASS],
      window: { resizable: true },
      position: { width: 600, height: 700 },
      tag: 'form',
      form: { submitOnChange: true, closeOnSubmit: false },
      actions: {},
    } as const;
  }

  return VttforgeBaseActorSheet as unknown as AnyConstructor;
}
