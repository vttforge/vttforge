/**
 * The globals `withMockFoundry` installs, declared so a test can name them.
 *
 * A test that mocks Foundry then reads `game.settings` gets "Cannot find name
 * 'game'" — the values exist at runtime and nothing told TypeScript. Shipped
 * rather than kept internal because every consumer writing tests hits this on
 * the first one.
 *
 * Deliberately loose. Typing the Foundry runtime is `@vttforge/types`' job;
 * this only exists so the names resolve.
 */
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

export {};
