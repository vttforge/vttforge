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
 * viewer.goToPage(3);      // no such method — accepted
 * viewer.tpyoDeVerdade();  // not even a real name — accepted
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
 * thirty-three errors naming eight distinct members — a set small enough to
 * declare, which is what settled the design. It is not the whole ApplicationV2
 * surface and does not claim to be; `@vttforge/types` is where that lands.
 *
 * Reaching a member that is not here is a cast, and a cast is a sentence you
 * write on purpose. That is the difference from an index signature, which
 * writes it for you on every line.
 */

/**
 * The ApplicationV2 surface these bases rely on.
 *
 * Deliberately small. Every member here is one a real consumer used, not one
 * that exists in Foundry — the point is to describe what the factories stand
 * on, not to restate Foundry's API.
 */
export interface ApplicationV2Members {
  /** The window's root element once rendered. `undefined` before that. */
  readonly element: HTMLElement | undefined;

  /** The window title, from `options.window.title`. */
  readonly title: string;

  /** Whether the window is currently rendered. */
  readonly rendered: boolean;

  /** Render the application. Resolves when the render completes. */
  render(options?: unknown, _options?: unknown): Promise<unknown>;

  /** Close the window. */
  close(options?: unknown): Promise<unknown>;

  /** Build the render context. */
  _prepareContext(options: unknown): Promise<Record<string, unknown>>;

  /** Runs after every render. */
  _onRender(context: unknown, options: unknown): void;

  /** Runs after the first render only. */
  _onFirstRender(context: unknown, options: unknown): void;

  /** The resolved options this instance was constructed with. */
  readonly options: Record<string, unknown>;
}

/**
 * What a document sheet adds on top of an application.
 */
export interface DocumentSheetV2Members extends ApplicationV2Members {
  /**
   * The document this sheet is for.
   *
   * Typed loosely on purpose: which document, and what its `system` holds,
   * is the consumer's to know. Narrow it with a getter on your subclass.
   */
  readonly document: unknown;

  /** Whether the current user may edit this document. */
  readonly isEditable: boolean;
}

/**
 * A class this SDK built on top of a Foundry one.
 *
 * `Added` is what the factory contributes; `Foundry` is the part of Foundry's
 * own surface the factory stands on. Anything outside both is a cast — see
 * the note at the top of this file for why that is the point.
 *
 * `Foundry` defaults to nothing rather than to the application surface. A
 * `TypeDataModel` is not an application, and defaulting the other way handed
 * data models a `render` and a `close` they do not have.
 */
export type VttforgeClass<Added, Statics = unknown, Foundry = unknown> = Statics & {
  // biome-ignore lint/suspicious/noExplicitAny: forwards Foundry's own constructor arity
  new (...args: any[]): Added & Foundry;
};
