/**
 * Foundry runtime globals, typed by `@vttforge/types`.
 *
 * An ambient declaration, so it lives in a `.d.ts` and `include` picks it up.
 * Nothing imports it.
 *
 * `var`, not `const`. Two `declare global` blocks naming the same global have
 * to merge, and only `var` merges. A `const` here collides with the identical
 * declaration `@vttforge/testing` ships, and `tsc` stops with TS2451.
 *
 * `@vttforge/types` describes `game`, `ui`, `CONFIG`, `CONST`, the hook map
 * and the document classes. It does not yet describe the `foundry.*`
 * namespace, so `FoundryNamespace` below narrows the members this scaffold
 * reaches for. Add to it as you use more, rather than widening the whole
 * namespace to `any`: a typo in a namespaced path is the kind of mistake that
 * only shows up at runtime, in front of a player.
 */
import type {
  ChatMessageConstructor,
  FoundryConfig,
  FoundryConstants,
  Game,
  HooksApi,
  RollConstructor,
  UiApi,
} from '@vttforge/types';

interface TextEditorImplementation {
  enrichHTML(content: string, options?: Record<string, unknown>): Promise<string>;
}

interface FoundryNamespace {
  readonly applications: {
    readonly api: {
      readonly DialogV2: {
        confirm(options: Record<string, unknown>): Promise<boolean>;
      };
    };
    readonly handlebars: {
      renderTemplate(path: string, context: unknown): Promise<string>;
    };
    readonly ux: {
      readonly TextEditor: { readonly implementation: TextEditorImplementation };
    };
  };
  readonly utils: {
    mergeObject<T>(original: T, other?: object, options?: object): T;
    randomID(length?: number): string;
  };
}

declare global {
  var game: Game;
  var CONFIG: FoundryConfig;
  var CONST: FoundryConstants;
  var Hooks: HooksApi;
  var ui: UiApi;
  var foundry: FoundryNamespace;
  var Roll: RollConstructor;
  var ChatMessage: ChatMessageConstructor;
}
