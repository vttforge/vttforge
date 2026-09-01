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
declare global {
  // biome-ignore lint/suspicious/noExplicitAny: stub declarations only
  const game: any;
  // biome-ignore lint/suspicious/noExplicitAny: stub declarations only
  const CONFIG: any;
  // biome-ignore lint/suspicious/noExplicitAny: stub declarations only
  const Hooks: any;
  // biome-ignore lint/suspicious/noExplicitAny: stub declarations only
  const ui: any;
  // biome-ignore lint/suspicious/noExplicitAny: stub declarations only
  const ChatMessage: any;
  // biome-ignore lint/suspicious/noExplicitAny: stub declarations only
  const Roll: any;
  // biome-ignore lint/suspicious/noExplicitAny: stub declarations only
  const foundry: any;
}

export {};
