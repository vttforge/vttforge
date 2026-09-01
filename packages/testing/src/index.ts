/**
 * @vttforge/testing — helpers for testing Foundry packages.
 *
 * Two entry points, because the two kinds of test run in different places:
 *
 * - `@vttforge/testing/vitest` runs in CI against mocked globals, and covers
 *   everything up to the moment a window renders.
 * - `@vttforge/testing/quench` runs inside a live world, for what a mock
 *   cannot answer.
 *
 * The root re-exports both so a single import works while you are finding
 * your way around.
 */
export * from './quench/index.js';
export * from './vitest/index.js';
