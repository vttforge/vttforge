/**
 * The Foundry surface the VTTForge base factories stand on.
 *
 * Deliberately small. Every member here is one a real consumer used, not one
 * that exists in Foundry. The point is to describe what the factories stand
 * on, not to restate Foundry's API. Reaching a member that is not here is a
 * cast, and a cast is a sentence you write on purpose.
 */

import type {
  ApplicationConfiguration,
  ApplicationRenderContext,
  ApplicationRenderOptions,
} from './application.js';
import type { DocumentMembers } from './documents.js';

/**
 * The ApplicationV2 surface these bases rely on.
 *
 * Deliberately small. Every member here is one a real consumer used, not one
 * that exists in Foundry. The point is to describe what the factories stand
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
  render(
    options?: ApplicationRenderOptions | boolean,
    _options?: ApplicationRenderOptions,
  ): Promise<this>;

  /** Close the window. */
  close(options?: Record<string, unknown>): Promise<this>;

  /** Build the render context. */
  _prepareContext(options: ApplicationRenderOptions): Promise<ApplicationRenderContext>;

  /** Runs after `_prepareContext` and before the frame renders. New in v14. */
  _preRender(context: ApplicationRenderContext, options: ApplicationRenderOptions): Promise<void>;

  /** Runs after every render. */
  _onRender(context: ApplicationRenderContext, options: ApplicationRenderOptions): void;

  /** Runs after the first render only. */
  _onFirstRender(context: ApplicationRenderContext, options: ApplicationRenderOptions): void;

  /** Move the window into its own browser window. New in v14. */
  detachWindow(): void;
  attachWindow(): void;

  /** The resolved options this instance was constructed with. */
  readonly options: ApplicationConfiguration;
}

/**
 * What a document sheet adds on top of an application.
 *
 * `TDocument` is the document this sheet is for. It defaults to the shared
 * document surface, so a sheet that says nothing still reads `name`, `system`
 * and `update()`. Pass your own type to narrow it further.
 */
export interface DocumentSheetV2Members<TDocument = DocumentMembers> extends ApplicationV2Members {
  /** The document this sheet is for. */
  readonly document: TDocument;

  /** Whether the current user may edit this document. */
  readonly isEditable: boolean;
}

/**
 * A class this SDK built on top of a Foundry one.
 *
 * `Added` is what the factory contributes; `Foundry` is the part of Foundry's
 * own surface the factory stands on. Anything outside both is a cast; see
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
