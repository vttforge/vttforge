/**
 * `@vttforge/testing/vitest`: the half that runs in CI.
 *
 * Covers everything up to the moment a window renders: data models, settings,
 * hook registration, migrations, document updates. Past that, use the Quench
 * half inside a real world.
 *
 * Importing this also declares the Foundry globals, so a test can name `game`
 * and `CONFIG` without "Cannot find name". They arrive with the import rather
 * than a `types` entry: a subpath export cannot be resolved that way, and a
 * test importing the helpers is already the moment it needs them.
 */
export {
  createMockActor,
  createMockConfig,
  createMockItem,
  type MockDocument,
  type MockDocumentOptions,
} from './mock-foundry.js';
export {
  type MockFoundry,
  type MockFoundryOptions,
  type RecordedEnricher,
  type RecordedHook,
  type RecordedSetting,
  type RecordedSheet,
  withMockFoundry,
} from './with-mock-foundry.js';

/**
 * `var`, not `const`, and the same types a consumer declares.
 *
 * A package that consumes this already declares these globals for its own
 * source. Two `declare global` blocks naming one global have to agree on two
 * things, and this block used to get only the first right.
 *
 * `var`, because `const` is block-scoped: a second one is a redeclaration and
 * `tsc` stops with TS2451.
 *
 * The same type, because `tsc` stops with TS2403 otherwise, and `any` is not a
 * free pass. This block said `any` and the scaffolded templates say `Game`,
 * `FoundryConfig` and the rest, so adding these helpers to a scaffolded project
 * produced six errors at once, at the moment a reader most wants them. Both
 * sides now name the types `@vttforge/types` describes, so they merge.
 */
import type {
  FoundryConfig,
  FoundryConstants,
  FoundryNamespace,
  Game,
  HooksApi,
  UiApi,
} from '@vttforge/types';

declare global {
  var foundry: FoundryNamespace;
  var game: Game;
  var CONFIG: FoundryConfig;
  var Hooks: HooksApi;
  var ui: UiApi;
  var CONST: FoundryConstants;
}
