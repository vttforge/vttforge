import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BaseActorSheet, VTTFORGE_SHEET_CLASS } from '../base-actor-sheet.js';
import { VttfError } from '../errors/registry.js';

class FakeActorSheetV2 {}

const HandlebarsApplicationMixin = (base: typeof FakeActorSheetV2) =>
  class extends base {
    static readonly _mixed = true;
  };

beforeEach(() => {
  (globalThis as Record<string, unknown>).foundry = {
    applications: {
      sheets: { ActorSheetV2: FakeActorSheetV2 },
      api: { HandlebarsApplicationMixin },
    },
  };
});

afterEach(() => {
  delete (globalThis as Record<string, unknown>).foundry;
});

describe('BaseActorSheet', () => {
  it('throws VTTF-0002 when the required globals are missing', () => {
    delete (globalThis as Record<string, unknown>).foundry;
    expect(() => BaseActorSheet()).toThrow(VttfError);
  });

  it('returns a class that extends ActorSheetV2 via HandlebarsApplicationMixin', () => {
    const Sub = BaseActorSheet();
    const instance = new Sub();
    expect(instance).toBeInstanceOf(FakeActorSheetV2);
    expect((Sub as unknown as { _mixed: boolean })._mixed).toBe(true);
  });

  it('always ships the vttforge marker class in DEFAULT_OPTIONS', () => {
    const Sub = BaseActorSheet();
    const opts = (Sub as unknown as { DEFAULT_OPTIONS: { classes: readonly string[] } })
      .DEFAULT_OPTIONS;
    expect(opts.classes).toContain(VTTFORGE_SHEET_CLASS);
  });

  it('defaults DEFAULT_OPTIONS to a sensible form-mode submitOnChange config', () => {
    const Sub = BaseActorSheet();
    const opts = (
      Sub as unknown as {
        DEFAULT_OPTIONS: {
          tag: string;
          form: { submitOnChange: boolean; closeOnSubmit: boolean };
          window: { resizable: boolean };
        };
      }
    ).DEFAULT_OPTIONS;
    expect(opts.tag).toBe('form');
    expect(opts.form.submitOnChange).toBe(true);
    expect(opts.form.closeOnSubmit).toBe(false);
    expect(opts.window.resizable).toBe(true);
  });
});
