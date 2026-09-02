/**
 * Registering a Quench batch, for the tests that need a real Foundry.
 *
 * The vitest half covers everything up to the moment a window renders. Past
 * that (a sheet that actually draws, a socket with two clients, a document
 * that really round-trips through the database) needs the real thing, and
 * Quench is how the community runs those from inside a running world.
 *
 * The whole ceremony is one `quenchReady` hook and a registration call, which
 * everyone writes again and gets subtly wrong: register too early and Quench
 * is not there, too late and the batch is missed.
 */

/** What Quench hands a batch to describe its cases. */
export interface QuenchContext {
  describe(title: string, fn: () => void): void;
  it(title: string, fn: () => unknown): void;
  before(fn: () => unknown): void;
  after(fn: () => unknown): void;
  beforeEach(fn: () => unknown): void;
  afterEach(fn: () => unknown): void;
  // biome-ignore lint/suspicious/noExplicitAny: Quench bundles chai, whose assert surface is its own
  assert: any;
  // biome-ignore lint/suspicious/noExplicitAny: chai's expect, likewise
  expect: any;
}

export interface BatchOptions {
  /** Shown in the Quench window. Defaults to the batch id. */
  displayName?: string;
  /**
   * Groups the batch in the Quench UI. Use your package id so a user running
   * everything can tell whose failures are whose.
   */
  snapBaseline?: boolean;
}

interface QuenchApi {
  registerBatch(
    id: string,
    fn: (context: QuenchContext) => void,
    options?: Record<string, unknown>,
  ): void;
}

/**
 * Register a batch once Quench is ready.
 *
 * Safe to call at module scope: it waits for the hook rather than assuming
 * Quench has loaded, which is the mistake that makes a batch silently never
 * appear.
 *
 * ```ts
 * registerBatch('my-module.sheets', ({ describe, it, assert }) => {
 *   describe('character sheet', () => {
 *     it('renders', async () => {
 *       const actor = await Actor.create({ name: 'T', type: 'character' });
 *       await actor.sheet.render(true);
 *       assert.ok(actor.sheet.rendered);
 *       await actor.delete();
 *     });
 *   });
 * });
 * ```
 */
export function registerBatch(
  id: string,
  fn: (context: QuenchContext) => void,
  options: BatchOptions = {},
): void {
  const hooks = (globalThis as Record<string, unknown>).Hooks as
    | { once(event: string, cb: (quench: QuenchApi) => void): void }
    | undefined;

  if (!hooks?.once) {
    // No Foundry here at all. Quench batches only mean anything inside a
    // running world, so this is a no-op rather than an error. It lets a file
    // holding both kinds of test be imported by the vitest run.
    return;
  }

  hooks.once('quenchReady', (quench) => {
    quench.registerBatch(id, fn, { displayName: options.displayName ?? id, ...options });
  });
}
