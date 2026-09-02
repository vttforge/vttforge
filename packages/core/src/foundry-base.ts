/**
 * How a base factory reports what it returns.
 *
 * These factories mix VTTForge behaviour into a Foundry class resolved at
 * runtime, so the result has two halves: what we add, and what Foundry brings.
 *
 * ## What the index signature cost
 *
 * The first version returned `any` for the whole thing. The second kept our
 * half typed and let Foundry's through `[member: string]: any`. Both were
 * measured against two real consumers, and the index signature turned out to
 * be the worse of the two failures rather than a middle ground:
 *
 * ```ts
 * const viewer = new PdfViewer();
 * viewer.goToPage(3);      // no such method, accepted
 * viewer.tpyoDeVerdade();  // not even a real name, accepted
 * ```
 *
 * A module shipped a release calling `url` and `goToPage` on a viewer that
 * had neither, and nothing reported it. An index signature makes every
 * property access legal, so a typo in the consumer's own subclass reads as
 * valid code.
 *
 * And it did not even buy the thing it looked like it bought:
 *
 * ```
 * error TS4113: This member cannot have an 'override' modifier because it is
 * not declared in the base class.
 * ```
 *
 * An index signature is not a declaration, so `override` on a Foundry member
 * was rejected anyway. It permitted what should have failed and forbade what
 * should have worked.
 *
 * ## What replaced it
 *
 * The Foundry members these factories actually stand on are written down
 * below. Removing the index signature and running both consumers produced
 * thirty-three errors naming eight distinct members, a set small enough to
 * declare, which is what settled the design. It is not the whole ApplicationV2
 * surface and does not claim to be; `@vttforge/types` is where that lands.
 *
 * Reaching a member that is not here is a cast, and a cast is a sentence you
 * write on purpose. That is the difference from an index signature, which
 * writes it for you on every line.
 */

export type {
  ApplicationV2Members,
  DocumentSheetV2Members,
  VttforgeClass,
} from '@vttforge/types';
