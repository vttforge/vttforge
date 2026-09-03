/**
 * Minimal Foundry runtime globals for the example.
 *
 * `checkJs` is on here, which is the point: it compiles the example the way a
 * consumer's own JavaScript gets compiled, so the SDK's inferred types are
 * exercised against real code rather than only against type tests.
 *
 * These stubs are deliberately `any`. Typing the Foundry runtime is
 * `@vttforge/types`' job; what this file exists to do is stop "Cannot find
 * name 'game'" from drowning out the errors that actually matter.
 */
/**
 * `var`, not `const`. Two `declare global` blocks naming the same global have
 * to merge, and only `var` merges. A `const` here collides with the identical
 * declaration `@vttforge/testing` ships, and `tsc` stops with TS2451.
 */
declare global {
  // biome-ignore lint/suspicious/noExplicitAny: stub declarations only
  var game: any;
  // biome-ignore lint/suspicious/noExplicitAny: stub declarations only
  var CONFIG: any;
  // biome-ignore lint/suspicious/noExplicitAny: stub declarations only
  var Hooks: any;
  // biome-ignore lint/suspicious/noExplicitAny: stub declarations only
  var ui: any;
  // biome-ignore lint/suspicious/noExplicitAny: stub declarations only
  var ChatMessage: any;
  // biome-ignore lint/suspicious/noExplicitAny: stub declarations only
  var Roll: any;
  // biome-ignore lint/suspicious/noExplicitAny: stub declarations only
  var foundry: any;
}

export {};
