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
import type { RollConstructor } from './dice.js';
import type { DocumentMembers } from './documents.js';
import type { AnyClass, FoundryUtils } from './utils.js';

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

/**
 * A namespace of classes, with the names real consumers reach for spelled out.
 *
 * `foundry.data.fields` holds a few dozen classes, and restating every one
 * would be restating Foundry. Naming the ones this SDK and its consumers
 * actually use buys the thing that matters: `foundry.data.feilds.StringField`
 * stops compiling, and a misspelled namespace path is the mistake that survives
 * review and fails in front of a player.
 *
 * A name outside the list still resolves, as `AnyClass | undefined`. That is
 * the index signature being honest under `noUncheckedIndexedAccess`: this
 * package did not promise the member is there. Narrow it, or add the name here.
 */
export type FoundryClassNamespace<Known extends string = never> = Readonly<
  Record<Known, AnyClass>
> &
  Readonly<Record<string, AnyClass | undefined>>;

/** Field classes for a schema. */
export type FoundryFieldNames =
  | 'ArrayField'
  | 'BooleanField'
  | 'ColorField'
  | 'DataField'
  | 'EmbeddedDataField'
  | 'EmbeddedDocumentField'
  | 'FilePathField'
  | 'ForeignDocumentField'
  | 'HTMLField'
  | 'NumberField'
  | 'ObjectField'
  | 'SchemaField'
  | 'SetField'
  | 'StringField'
  | 'TypedSchemaField';

/** Sidebar collections, the ones a package registers a sheet against. */
export type FoundryCollectionNames =
  | 'Actors'
  | 'ChatMessages'
  | 'CompendiumCollection'
  | 'CompendiumPacks'
  | 'Folders'
  | 'Items'
  | 'Journal'
  | 'Macros'
  | 'Playlists'
  | 'RollTables'
  | 'Scenes'
  | 'Users';

/** `foundry.applications.ux.TextEditor.implementation`. */
export interface TextEditorImplementation {
  /** Expand `@UUID` links, inline rolls and the rest, into HTML. */
  enrichHTML(content: string, options?: Record<string, unknown>): Promise<string>;
}

/** `foundry.applications.api`. */
export interface FoundryApplicationsApi {
  readonly ApplicationV2: AnyClass;
  readonly DocumentSheetV2: AnyClass;
  readonly DialogV2: AnyClass & {
    /** Ask a yes or no question. Resolves to what the reader chose. */
    confirm(options?: Record<string, unknown>): Promise<boolean>;
    /** Ask for input. Resolves to the form data, or `null` when dismissed. */
    prompt(options?: Record<string, unknown>): Promise<unknown>;
    /** Render and wait. Rejects when dismissed, unless told otherwise. */
    wait(options?: Record<string, unknown>): Promise<unknown>;
  };
  /** Adds `PARTS` and template rendering to an ApplicationV2 subclass. */
  HandlebarsApplicationMixin(base: AnyClass): AnyClass;
}

/** `foundry.applications`. */
export interface FoundryApplications {
  readonly api: FoundryApplicationsApi;
  readonly sheets: FoundryClassNamespace<
    | 'ActiveEffectConfig'
    | 'ActorSheetV2'
    | 'ItemSheetV2'
    | 'MacroConfig'
    | 'SceneConfig'
    | 'TokenConfig'
  >;
  readonly apps: FoundryClassNamespace<'DocumentSheetConfig' | 'FilePicker' | 'ImagePopout'>;
  /** Form input builders: `createFormGroup`, `createSelectInput` and the rest. */
  readonly fields: Readonly<Record<string, (...args: never[]) => HTMLElement>>;
  readonly handlebars: {
    /** Render one template with a context. */
    renderTemplate(path: string, context: unknown): Promise<string>;
    /** Warm the template cache, usually in `init`. */
    loadTemplates(paths: readonly string[] | Record<string, string>): Promise<unknown>;
  };
  readonly ux: FoundryClassNamespace<
    | 'ContextMenu'
    | 'DragDrop'
    | 'Draggable'
    | 'FormDataExtended'
    | 'ProseMirrorEditor'
    | 'SearchFilter'
    | 'Tabs'
  > & {
    readonly TextEditor: { readonly implementation: TextEditorImplementation };
  };
}

/**
 * The `foundry` global.
 *
 * Same rule as the rest of this file: every member is one a real consumer
 * reached for, not one that exists in Foundry. Reaching past it is a cast, and
 * a cast is a sentence you write on purpose.
 *
 * Declare it in your own project and the members below are typed:
 *
 * ```ts
 * import type { FoundryNamespace } from '@vttforge/types';
 *
 * declare global {
 *   // `var`, not `const`: two blocks naming one global only merge as `var`.
 *   var foundry: FoundryNamespace;
 * }
 * ```
 */
export interface FoundryNamespace {
  readonly abstract: FoundryClassNamespace<'DataModel' | 'Document' | 'TypeDataModel'>;
  readonly applications: FoundryApplications;
  readonly data: {
    /** Field classes for a schema: `StringField`, `NumberField` and the rest. */
    readonly fields: FoundryClassNamespace<FoundryFieldNames>;
    /** For an update that deletes or replaces rather than merging. */
    readonly operators: FoundryClassNamespace<'ForcedDeletion' | 'ForcedReplacement'>;
  };
  readonly dice: FoundryClassNamespace<'DiceTerm' | 'Die' | 'RollTerm'> & {
    readonly Roll: RollConstructor;
  };
  readonly documents: { readonly collections: FoundryClassNamespace<FoundryCollectionNames> };
  readonly canvas: FoundryClassNamespace;
  /**
   * `foundry.utils`, plus the two file helpers that live there and are not part
   * of the documented utility surface.
   */
  readonly utils: FoundryUtils & {
    /** Offer `data` to the reader as a download. */
    saveDataToFile(data: string, type: string, filename: string): void;
    /** Read a file the reader picked. */
    readTextFromFile(file: File): Promise<string>;
  };
}
