/**
 * `@vttforge/testing/vitest` — the half that runs in CI.
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
} from './mock-foundry.js';
export {
  type MockFoundry,
  type RecordedHook,
  type RecordedSetting,
  withMockFoundry,
} from './with-mock-foundry.js';

declare global {
  // biome-ignore lint/suspicious/noExplicitAny: the Foundry surface is typed elsewhere
  const foundry: any;
  // biome-ignore lint/suspicious/noExplicitAny: the Foundry surface is typed elsewhere
  const game: any;
  // biome-ignore lint/suspicious/noExplicitAny: the Foundry surface is typed elsewhere
  const CONFIG: any;
  // biome-ignore lint/suspicious/noExplicitAny: the Foundry surface is typed elsewhere
  const Hooks: any;
  // biome-ignore lint/suspicious/noExplicitAny: the Foundry surface is typed elsewhere
  const ui: any;
  // biome-ignore lint/suspicious/noExplicitAny: the Foundry surface is typed elsewhere
  const CONST: any;
}
