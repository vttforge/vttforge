/**
 * Wiring: read the address, build the Foundry surface, connect.
 *
 * Kept apart from the entry point so every decision here — which host to
 * reach, what counts as a usable global — can be tested without a browser.
 */
import { type Connection, connect, type SocketLike } from './client.js';
import type { AppV2Like, FoundryEnv } from './reload.js';

export const MODULE_ID = 'vttforge-dev';

/** Where `vttforge dev` listens unless told otherwise. */
export const DEFAULT_PORT = 31313;

/**
 * Work out the dev server address.
 *
 * Foundry commonly runs in a container while the CLI runs on the host, and
 * from inside a container `localhost` is the container. Docker publishes the
 * host as `host.docker.internal`, so when the page is not served from a local
 * address that is the better guess — a wrong guess here just fails to
 * connect, which is visible and harmless.
 */
export function resolveServerUrl(
  hostname: string,
  port: number = DEFAULT_PORT,
  override?: string | null,
): string {
  if (override) return override;
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
  const host = isLocal ? hostname : 'host.docker.internal';
  return `ws://${host}:${port}`;
}

export interface BootstrapDeps {
  globals: Record<string, unknown>;
  location: { hostname: string };
  createSocket: (url: string) => SocketLike;
  setTimer: (fn: () => void, ms: number) => unknown;
  log: (message: string, ...rest: unknown[]) => void;
  port?: number;
  override?: string | null;
}

/**
 * Build the environment the handlers need out of Foundry's globals.
 *
 * Returns null when the globals are not there. That is not a failure worth
 * shouting about — it means this ran outside Foundry, and refusing to connect
 * is the correct response.
 */
export function buildEnv(deps: BootstrapDeps): FoundryEnv | null {
  const g = deps.globals;
  const foundry = g.foundry as
    | {
        applications?: { instances?: Map<unknown, { render: () => void }> };
        utils?: { mergeObject?: FoundryEnv['mergeObject'] };
      }
    | undefined;
  const game = g.game as FoundryEnv['game'] | undefined;
  const Handlebars = g.Handlebars as FoundryEnv['Handlebars'] | undefined;
  const Hooks = g.Hooks as { call: (name: string, data: unknown) => boolean } | undefined;
  const mergeObject = foundry?.utils?.mergeObject;
  const doc = g.document as Document | undefined;

  if (!game || !Handlebars || !Hooks || !mergeObject || !doc) return null;

  return {
    Handlebars,
    game,
    ui: g.ui as FoundryEnv['ui'],
    applicationInstances: (): Iterable<AppV2Like> =>
      foundry?.applications?.instances?.values() ?? [],
    mergeObject,
    callHook: (name, data) => Hooks.call(name, data),
    document: doc,
    now: () => Date.now(),
  };
}

/** Connect, or explain why not. Returns null when there is nothing to do. */
export function bootstrap(deps: BootstrapDeps): Connection | null {
  const env = buildEnv(deps);
  if (!env) {
    deps.log('Foundry globals are not available — not connecting.');
    return null;
  }
  const url = resolveServerUrl(deps.location.hostname, deps.port, deps.override);
  deps.log(`watching for changes from ${url}`);
  return connect({
    url,
    env,
    createSocket: deps.createSocket,
    setTimer: deps.setTimer,
    log: deps.log,
  });
}
