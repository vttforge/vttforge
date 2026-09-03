/**
 * Minimal Foundry runtime globals.
 *
 * These declarations let the scaffold compile cleanly without an external
 * type package. Replace with `fvtt-types` (community-maintained, pinned to
 * a known-working commit SHA) or `@vttforge/types` (coming in a later
 * VTTForge release) for full type coverage.
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
  var foundry: any;
}

export {};
