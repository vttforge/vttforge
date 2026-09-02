/**
 * The Foundry surface the VTTForge base factories stand on.
 *
 * Deliberately small. Every member here is one a real consumer used, not one
 * that exists in Foundry. The point is to describe what the factories stand
 * on, not to restate Foundry's API. Reaching a member that is not here is a
 * cast, and a cast is a sentence you write on purpose.
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
