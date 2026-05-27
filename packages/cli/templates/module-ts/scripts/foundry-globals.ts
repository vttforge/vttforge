/**
 * Minimal Foundry runtime globals.
 *
 * These declarations let the scaffold compile cleanly without an external
 * type package. Replace with `fvtt-types` (community-maintained, pinned to
 * a known-working commit SHA) or `@vttforge/types` (coming in a later
 * VTTForge release) for full type coverage.
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
  const foundry: any;
}

export {};
