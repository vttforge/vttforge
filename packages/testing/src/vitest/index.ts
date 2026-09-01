/**
 * `@vttforge/testing/vitest` — the half that runs in CI.
 *
 * Covers everything up to the moment a window renders: data models, settings,
 * hook registration, migrations, document updates. Past that, use the Quench
 * half inside a real world.
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
