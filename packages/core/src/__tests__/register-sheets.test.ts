/**
 * The bug these cases exist for.
 *
 * Foundry keys a sheet by `${scope}.${sheetClass.name}` and writes that key to
 * `flags.core.sheetClass` on every document whose owner picked the sheet. A
 * bundler renames classes, so the same sheet registered as `mo` in one build
 * and `vo` in the next — and every saved choice pointed at nothing. Foundry
 * fell back to the default sheet without a word in the console.
 *
 * Observed on a real module across three builds. These pin the fix: the caller
 * names the sheet, and the name is what Foundry sees.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { VttfError } from '../errors/registry.js';
import { registerSheets } from '../register-sheets.js';

interface Registered {
  documentClass: unknown;
  scope: string;
  sheetClass: { name: string };
  options: Record<string, unknown>;
}

let calls: Registered[];

/** The one registration a case just made. */
function only(): Registered {
  expect(calls).toHaveLength(1);
  return calls[0] as Registered;
}

const DOCUMENT_CLASSES = { Actor: 'ActorClass', Item: 'ItemClass' } as const;

beforeEach(() => {
  calls = [];
  (globalThis as Record<string, unknown>).foundry = {
    applications: {
      apps: {
        DocumentSheetConfig: {
          registerSheet(
            documentClass: unknown,
            scope: string,
            sheetClass: { name: string },
            options: Record<string, unknown>,
          ) {
            calls.push({ documentClass, scope, sheetClass, options });
          },
        },
      },
    },
  };
});

afterEach(() => {
  delete (globalThis as Record<string, unknown>).foundry;
});

describe('registerSheets', () => {
  it('registers under the id the caller chose, not the class name', () => {
    // What a minifier leaves behind.
    class mo {}

    registerSheets(
      'pdf-character-sheet',
      [{ id: 'fillable', document: 'Actor', sheet: mo }],
      DOCUMENT_CLASSES,
    );

    // The key Foundry will persist.
    const call = only();
    expect(`${call.scope}.${call.sheetClass.name}`).toBe('pdf-character-sheet.fillable');
  });

  it('keeps that key across a rebuild that renames the class', () => {
    const keyAfter = (Sheet: unknown) => {
      calls = [];
      registerSheets(
        'pdf-character-sheet',
        [{ id: 'fillable', document: 'Actor', sheet: Sheet }],
        DOCUMENT_CLASSES,
      );
      const call = only();
      return `${call.scope}.${call.sheetClass.name}`;
    };

    // The same source class, as two builds named it.
    class mo {}
    class vo {}
    expect(keyAfter(mo)).toBe(keyAfter(vo));
  });

  it('passes the document class for the kind', () => {
    class Actorish {}
    class Itemish {}
    registerSheets(
      'my-module',
      [
        { id: 'actor-sheet', document: 'Actor', sheet: Actorish },
        { id: 'item-sheet', document: 'Item', sheet: Itemish },
      ],
      DOCUMENT_CLASSES,
    );
    expect(calls.map((c) => c.documentClass)).toEqual(['ActorClass', 'ItemClass']);
  });

  it('forwards types, label and the default flags', () => {
    class Sheet {}
    registerSheets(
      'my-module',
      [
        {
          id: 'pdf',
          document: 'Item',
          sheet: Sheet,
          types: ['my-module.pdf'],
          label: 'MY_MODULE.Sheet.title',
          makeDefault: true,
        },
      ],
      DOCUMENT_CLASSES,
    );
    expect(only().options).toEqual({
      types: ['my-module.pdf'],
      label: 'MY_MODULE.Sheet.title',
      makeDefault: true,
      canBeDefault: true,
      canConfigure: true,
    });
  });

  it('refuses a dotted id, which would make the key ambiguous', () => {
    class Sheet {}
    expect(() =>
      registerSheets(
        'my-module',
        [{ id: 'nested.sheet', document: 'Actor', sheet: Sheet }],
        DOCUMENT_CLASSES,
      ),
    ).toThrow(VttfError);
  });

  it('refuses an empty id', () => {
    class Sheet {}
    expect(() =>
      registerSheets('my-module', [{ id: '', document: 'Actor', sheet: Sheet }], DOCUMENT_CLASSES),
    ).toThrow(VttfError);
  });

  it('refuses two sheets with the same id, which would silently overwrite', () => {
    class First {}
    class Second {}
    expect(() =>
      registerSheets(
        'my-module',
        [
          { id: 'sheet', document: 'Actor', sheet: First },
          { id: 'sheet', document: 'Item', sheet: Second },
        ],
        DOCUMENT_CLASSES,
      ),
    ).toThrow(VttfError);
  });

  it('registers nothing when an id is bad, rather than half the list', () => {
    class Good {}
    class Bad {}
    expect(() =>
      registerSheets(
        'my-module',
        [
          { id: 'good', document: 'Actor', sheet: Good },
          { id: 'bad.id', document: 'Actor', sheet: Bad },
        ],
        DOCUMENT_CLASSES,
      ),
    ).toThrow(VttfError);
    expect(calls).toHaveLength(0);
  });

  it('says so when Foundry is not there', () => {
    delete (globalThis as Record<string, unknown>).foundry;
    class Sheet {}
    expect(() =>
      registerSheets(
        'my-module',
        [{ id: 'sheet', document: 'Actor', sheet: Sheet }],
        DOCUMENT_CLASSES,
      ),
    ).toThrow(VttfError);
  });
});
