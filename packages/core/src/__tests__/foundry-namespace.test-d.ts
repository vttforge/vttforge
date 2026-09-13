/**
 * What `FoundryNamespace` accepts and what it refuses.
 *
 * It exists so a project stops hand-writing its own. The value is not that
 * `foundry.utils.mergeObject` returns the right thing, it is that
 * `foundry.data.feilds` stops compiling. A misspelled namespace path is the
 * mistake that survives review and fails in front of a player, so every path a
 * consumer of this SDK reaches for is pinned below.
 */
import { describe, expectTypeOf, it } from 'vitest';
import type { AnyClass, FoundryNamespace, FoundryUtils, RollConstructor } from '../index.js';

declare const foundry: FoundryNamespace;

describe('the paths real consumers reach for', () => {
  // `toEqualTypeOf<AnyClass>` rather than `toBeFunction`: these carry a
  // construct signature and no call signature. It also pins the thing that
  // matters, that a named member is not `AnyClass | undefined`.
  it('names the application namespaces', () => {
    expectTypeOf(foundry.applications.api.ApplicationV2).toEqualTypeOf<AnyClass>();
    // A plain function, not a class: it takes a base and hands back a subclass.
    expectTypeOf(
      foundry.applications.api.HandlebarsApplicationMixin,
    ).returns.toEqualTypeOf<AnyClass>();
    expectTypeOf(foundry.applications.sheets.ActorSheetV2).toEqualTypeOf<AnyClass>();
    expectTypeOf(foundry.applications.apps.DocumentSheetConfig).toEqualTypeOf<AnyClass>();
    expectTypeOf(foundry.applications.ux.DragDrop).toEqualTypeOf<AnyClass>();
  });

  it('types the dialog helpers, which return different things', () => {
    expectTypeOf(foundry.applications.api.DialogV2.confirm).returns.toEqualTypeOf<
      Promise<boolean>
    >();
    expectTypeOf(foundry.applications.api.DialogV2.prompt).returns.toEqualTypeOf<
      Promise<unknown>
    >();
  });

  it('types the template helpers', () => {
    expectTypeOf(foundry.applications.handlebars.renderTemplate).returns.toEqualTypeOf<
      Promise<string>
    >();
    expectTypeOf(
      foundry.applications.ux.TextEditor.implementation.enrichHTML,
    ).returns.toEqualTypeOf<Promise<string>>();
  });

  it('names the data namespaces', () => {
    expectTypeOf(foundry.data.fields.StringField).toEqualTypeOf<AnyClass>();
    expectTypeOf(foundry.data.operators.ForcedReplacement).toEqualTypeOf<AnyClass>();
    expectTypeOf(foundry.abstract.TypeDataModel).toEqualTypeOf<AnyClass>();
  });

  it('keeps Roll typed, rather than leaving it a bare class', () => {
    expectTypeOf(foundry.dice.Roll).toEqualTypeOf<RollConstructor>();
  });

  it('carries the utilities, plus the two file helpers that live beside them', () => {
    expectTypeOf(foundry.utils.isNewerVersion).returns.toEqualTypeOf<boolean>();
    expectTypeOf(foundry.utils.randomID).returns.toEqualTypeOf<string>();
    expectTypeOf(foundry.utils.saveDataToFile).returns.toEqualTypeOf<void>();
    expectTypeOf(foundry.utils.readTextFromFile).returns.toEqualTypeOf<Promise<string>>();
  });
});

describe('two ways to write a type that compiles and cannot be called', () => {
  it('takes arguments on a form builder', () => {
    // `never[]` as the rest parameter reads fine and accepts no argument at
    // all: every real call fails with "not assignable to parameter of type
    // 'never'".
    expectTypeOf(foundry.applications.fields.createFormGroup).toBeCallableWith({
      label: 'Name',
    });
  });

  it('carries the file helpers once, from FoundryUtils', () => {
    // They were declared a second time in an intersection, on the claim that
    // `FoundryUtils` did not have them. It does, with the same signatures. Two
    // copies agree until one of them changes, and then the stale one wins.
    expectTypeOf<FoundryNamespace['utils']>().toEqualTypeOf<FoundryUtils>();
  });
});

describe('what it refuses', () => {
  it('has no key for a misspelled namespace', () => {
    expectTypeOf<FoundryNamespace>().not.toHaveProperty('util');
    expectTypeOf<FoundryNamespace['data']>().not.toHaveProperty('feilds');
    expectTypeOf<FoundryNamespace['applications']>().not.toHaveProperty('handlebar');
  });

  it('does not invent a namespace Foundry has no top-level name for', () => {
    expectTypeOf<FoundryNamespace>().not.toHaveProperty('fields');
    expectTypeOf<FoundryNamespace>().not.toHaveProperty('Roll');
  });
});
