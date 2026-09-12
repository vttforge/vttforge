/**
 * What a consumer gets back from the bases, pinned so it cannot narrow again.
 *
 * Each of these lines was a cast before `@vttforge/types` described the
 * document surface. They compile now; if one stops compiling, the surface
 * shrank and every sheet that reads it goes back to casting.
 */
import { describe, expectTypeOf, it } from 'vitest';
import type { BaseActorSheet } from '../base-actor-sheet.js';
import type { BaseItemSheet } from '../base-item-sheet.js';
import type { FieldInstance } from '../data/fields.js';
import type {
  ActiveEffectLike,
  ActorLike,
  FolderLike,
  ItemLike,
  TypedTypeDataModel,
} from '../index.js';

declare const sheet: InstanceType<ReturnType<typeof BaseActorSheet>>;
declare const itemSheet: InstanceType<ReturnType<typeof BaseItemSheet>>;

type Sys = { readonly level: number };
type Gear = ItemLike<{ readonly quantity: number }>;
declare const typed: InstanceType<ReturnType<typeof BaseActorSheet<ActorLike<Sys, Gear>>>>;

type Schema = Record<string, FieldInstance>;
declare const data: TypedTypeDataModel<Schema, ActorLike>;

describe('the sheet document', () => {
  it('is a document, not an unknown', () => {
    expectTypeOf(sheet.document.name).toEqualTypeOf<string>();
    expectTypeOf(sheet.document.id).toEqualTypeOf<string | null>();
    // Asserted on a leaf: `expectTypeOf` walks structurally, and these types
    // recurse (an item names its actor, which names its items).
    expectTypeOf(sheet.document.items.filter(() => true)[0]?.name).toEqualTypeOf<
      string | undefined
    >();
    expectTypeOf(itemSheet.document.actor?.name).toEqualTypeOf<string | undefined>();
  });

  it('narrows to the system schema when the sheet says which', () => {
    expectTypeOf(typed.document.system.level).toEqualTypeOf<number>();
    // The collection keeps the item's schema; reading it was `unknown` before.
    expectTypeOf(typed.document.items.filter(() => true)[0]?.system.quantity).toEqualTypeOf<
      number | undefined
    >();
  });
});

describe('the drop hooks', () => {
  it('hand over the document that was dropped', () => {
    expectTypeOf(sheet.onDropItem).parameter(0).toExtend<ItemLike>();
    expectTypeOf(sheet.onDropActor).parameter(0).toExtend<ActorLike>();
    expectTypeOf(sheet.onDropFolder).parameter(0).toEqualTypeOf<FolderLike>();
    expectTypeOf(sheet.onDropActiveEffect).parameter(0).toEqualTypeOf<ActiveEffectLike>();
  });
});

describe('the type data model', () => {
  it('reaches its owning document', () => {
    expectTypeOf(data.parent.name).toEqualTypeOf<string>();
    expectTypeOf(data.parent.items.filter(() => true)[0]?.name).toEqualTypeOf<string | undefined>();
  });
});
