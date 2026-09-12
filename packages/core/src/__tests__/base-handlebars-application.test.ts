// @vitest-environment happy-dom
/**
 * BaseHandlebarsApplication exists because a standalone templated window had
 * no typed base. The cases that matter are the ones proving the mixin is
 * applied and the empty-window trap is gone.
 *
 * The trap was met for real building a module on the SDK: a window with the
 * mixin and no `PARTS` opens, draws nothing, and reports nothing.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BaseHandlebarsApplication } from '../base-handlebars-application.js';
import { VttfError } from '../errors/registry.js';

class FakeApplicationV2 {}

/** Stands in for Foundry's mixin: marks the class and adds the part hook. */
function fakeMixin(Base: new (...args: unknown[]) => object): new (...args: unknown[]) => object {
  return class extends Base {
    static mixed = true;
    async _preparePartContext(_partId: string, context: unknown): Promise<unknown> {
      return context;
    }
  };
}

beforeEach(() => {
  (globalThis as Record<string, unknown>).foundry = {
    applications: {
      api: { ApplicationV2: FakeApplicationV2, HandlebarsApplicationMixin: fakeMixin },
    },
  };
});

afterEach(() => {
  delete (globalThis as Record<string, unknown>).foundry;
});

const PARTS = { body: { template: 'modules/x/templates/body.hbs' } };

describe('BaseHandlebarsApplication', () => {
  it('throws VTTF-0002 when ApplicationV2 is missing', () => {
    delete (globalThis as Record<string, unknown>).foundry;
    expect(() => BaseHandlebarsApplication()).toThrow(VttfError);
  });

  it('throws VTTF-0002 when the Handlebars mixin is missing', () => {
    (globalThis as Record<string, unknown>).foundry = {
      applications: { api: { ApplicationV2: FakeApplicationV2 } },
    };
    expect(() => BaseHandlebarsApplication()).toThrow(VttfError);
  });

  it('applies the mixin rather than extending ApplicationV2 bare', () => {
    class Window extends BaseHandlebarsApplication() {
      static PARTS = PARTS;
    }
    expect((Window as unknown as { mixed?: boolean }).mixed).toBe(true);
    expect(new Window()).toBeInstanceOf(FakeApplicationV2);
  });

  it('refuses to construct a window that declares no PARTS', () => {
    class Window extends BaseHandlebarsApplication() {}
    expect(() => new Window()).toThrow(VttfError);
    expect(() => new Window()).toThrow(/static PARTS/);
  });

  it('refuses an empty PARTS, which renders the same nothing', () => {
    class Window extends BaseHandlebarsApplication() {
      static PARTS = {};
    }
    expect(() => new Window()).toThrow(VttfError);
  });

  it('names the subclass in the error, not the base', () => {
    class ReportWindow extends BaseHandlebarsApplication() {}
    expect(() => new ReportWindow()).toThrow(/ReportWindow/);
  });
});
