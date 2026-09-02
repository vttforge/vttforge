/**
 * The hole this typing closed, pinned so it cannot reopen.
 *
 * These bases used to return an instance with `[member: string]: any`. That
 * made every property access legal — a module shipped a release calling
 * `url` and `goToPage` on a viewer that had neither, and nothing reported it.
 *
 * `@ts-expect-error` is the assertion here: each one fails the build if the
 * line it guards ever starts compiling again.
 */
import { describe, expectTypeOf, it } from 'vitest';
import type { BaseApplication } from '../base-application.js';
import type { ApplicationV2Members, DocumentSheetV2Members } from '../foundry-base.js';

declare const app: InstanceType<ReturnType<typeof BaseApplication>>;

describe('the base instance type', () => {
  it('carries the Foundry members these bases stand on', () => {
    expectTypeOf(app.render).toBeFunction();
    expectTypeOf(app.close).toBeFunction();
    expectTypeOf(app.element).toEqualTypeOf<HTMLElement | undefined>();
    expectTypeOf(app.title).toBeString();
  });

  it('carries what the factory itself adds', () => {
    expectTypeOf(app._replaceHTML).toBeFunction();
  });

  it('refuses a member nobody declared', () => {
    // @ts-expect-error — the shape of the bug this exists to prevent
    void app.goToPage;
    // @ts-expect-error — and a plain typo, which the index signature also ate
    void app.tpyoDeVerdade;
  });

  it('keeps the document surface off a plain application', () => {
    // @ts-expect-error — `document` belongs to a document sheet, not to this
    void app.document;
  });

  it('separates the two Foundry surfaces', () => {
    expectTypeOf<DocumentSheetV2Members>().toMatchTypeOf<ApplicationV2Members>();
    expectTypeOf<DocumentSheetV2Members['isEditable']>().toBeBoolean();
  });
});
