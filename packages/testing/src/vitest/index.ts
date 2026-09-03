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
 * `var`, not `const`, and that is the whole point.
 *
 * A package that consumes this already declares these globals for its own
 * source, because the SDK does not ship a Foundry runtime type. Two
 * `declare global` blocks naming the same thing have to merge, and only
 * `var` merges: `const` is block-scoped, so a second one is a redeclaration
 * and `tsc` stops with TS2451. Consumers hit that the moment they add the
 * test helpers to a typechecked project, which is the moment they most want
 * them.
 */
declare global {
  // biome-ignore lint/suspicious/noExplicitAny: the Foundry surface is typed elsewhere
  var foundry: any;
  // biome-ignore lint/suspicious/noExplicitAny: the Foundry surface is typed elsewhere
  var game: any;
  // biome-ignore lint/suspicious/noExplicitAny: the Foundry surface is typed elsewhere
  var CONFIG: any;
  // biome-ignore lint/suspicious/noExplicitAny: the Foundry surface is typed elsewhere
  var Hooks: any;
  // biome-ignore lint/suspicious/noExplicitAny: the Foundry surface is typed elsewhere
  var ui: any;
  // biome-ignore lint/suspicious/noExplicitAny: the Foundry surface is typed elsewhere
  var CONST: any;
}
