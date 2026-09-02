/**
 * The two registries a consumer could not reach before.
 *
 * `registerSystem({ sheets })` registers through
 * `foundry.applications.apps.DocumentSheetConfig`, which the mock did not
 * have — so a consumer's boot test got "Foundry is not available" instead of
 * a result. Enrichers landed on `CONFIG.TextEditor.enrichers` with no way to
 * read them back.
 *
 * These drive the globals the way `@vttforge/core` drives them, rather than
 * importing it: the package deliberately has no core dependency, and
 * `dogfood.test.ts` already stands a module entry up by hand for the same
 * reason.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { type MockFoundry, withMockFoundry } from '../vitest/with-mock-foundry.js';

let mock: MockFoundry | undefined;

/** What `registerSheets` does: pin the class name, then register. */
function registerSheet(
  packageId: string,
  id: string,
  sheet: { name: string },
  options: Record<string, unknown> = {},
): void {
  Object.defineProperty(sheet, 'name', { value: id, configurable: true });
  const { DocumentSheetConfig } = (
    globalThis as unknown as {
      foundry: {
        applications: {
          apps: {
            DocumentSheetConfig: {
              registerSheet(
                documentClass: unknown,
                scope: string,
                sheetClass: unknown,
                sheetOptions: Record<string, unknown>,
              ): void;
            };
          };
        };
      };
    }
  ).foundry.applications.apps;
  DocumentSheetConfig.registerSheet('ActorClass', packageId, sheet, options);
}

/** What `registerEnrichers` does: namespace the id, then push. */
function registerEnricher(packageId: string, entry: Record<string, unknown>): void {
  const { CONFIG } = globalThis as unknown as {
    CONFIG: { TextEditor: { enrichers: Array<Record<string, unknown>> } };
  };
  CONFIG.TextEditor.enrichers.push({ ...entry, id: `${packageId}.${entry.id}` });
}

afterEach(() => {
  mock?.restore();
  mock = undefined;
});

describe('sheets', () => {
  it('records the key Foundry would persist', () => {
    mock = withMockFoundry();
    // The name a minifier leaves behind.
    class e {}
    registerSheet('my-system', 'character', e, { types: ['character'], makeDefault: true });

    expect(mock.sheets).toHaveLength(1);
    expect(mock.sheets[0]?.key).toBe('my-system.character');
    expect(mock.sheets[0]?.id).toBe('character');
    expect(mock.sheets[0]?.options).toMatchObject({ types: ['character'], makeDefault: true });
  });

  it('keeps them in registration order', () => {
    mock = withMockFoundry();
    registerSheet('my-system', 'character', class {});
    registerSheet('my-system', 'gear', class {});
    expect(mock.sheets.map((s) => s.key)).toEqual(['my-system.character', 'my-system.gear']);
  });

  it('starts empty for each mock, so one test cannot leak into the next', () => {
    mock = withMockFoundry();
    registerSheet('my-system', 'character', class {});
    expect(mock.sheets).toHaveLength(1);
    mock.restore();

    mock = withMockFoundry();
    expect(mock.sheets).toHaveLength(0);
  });
});

describe('enrichers', () => {
  it('reads back what landed on CONFIG.TextEditor.enrichers', () => {
    mock = withMockFoundry();
    const pattern = /@PDF\[(.+?)\]/g;
    const onRender = () => undefined;
    registerEnricher('my-system', { id: 'link', pattern, enricher: () => null, onRender });

    expect(mock.enrichers).toHaveLength(1);
    expect(mock.enrichers[0]?.id).toBe('my-system.link');
    expect(mock.enrichers[0]?.pattern).toBe(pattern);
    expect(mock.enrichers[0]?.onRender).toBe(onRender);
  });

  it('starts empty for each mock', () => {
    mock = withMockFoundry();
    registerEnricher('first-system', { id: 'link', pattern: /a/g, enricher: () => null });
    expect(mock.enrichers).toHaveLength(1);
    mock.restore();

    mock = withMockFoundry();
    expect(mock.enrichers).toHaveLength(0);
  });
});
