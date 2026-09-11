/**
 * Talking to the other clients.
 *
 * Foundry gives a package one socket channel and one queries namespace, and
 * both are raw. The four things that go wrong are not in the API docs, they
 * are in every module that has shipped a socket:
 *
 * - **The channel name is not the package id.** It is `module.<id>` or
 *   `system.<id>`. A channel without the prefix is accepted by `emit` and
 *   delivered to nobody.
 * - **`"socket": true` is a manifest field.** Leave it out and `emit` still
 *   returns, the listener never fires, and nothing is logged.
 * - **The sender id comes from the server, not the payload.** Foundry appends
 *   the authenticated sender's id as the second argument of a listener. A
 *   sender written into the payload proves nothing: whoever built the payload
 *   chose it. Permission checks that read the payload are not checks.
 * - **Foundry never delivers a message back to whoever sent it.** A GM alone
 *   in a world sees nothing happen, with no error to tell that apart from a
 *   bug. So `emit` here runs the handler locally too, and strips the sender's
 *   own id from `recipients` so a routed send cannot arrive twice.
 *
 * Two directions, because packages need both:
 *
 * - `emit` is one-way. A GM turns everyone's page, a client is told to warm a
 *   cache. Nothing comes back.
 * - `askGm` is a question. A player cannot write to a world document, so they
 *   ask the GM's client to do it and wait for the answer. This rides on
 *   `CONFIG.queries` and `User#query` rather than the socket, because a query
 *   returns a value and reports a failure. A GM calling it runs the handler
 *   directly, with no round trip.
 *
 * Handlers fail closed. `from` defaults to `'gm'`, and a message from anyone
 * else is dropped without a notification: a player should learn nothing from
 * a message that was not meant to reach them.
 */

import { VttfError } from './errors/registry.js';
import type { FoundryConfig, Game, SocketApi, UserLike } from './foundry-globals.js';

/** Which manifest the package is declared in. Decides the channel prefix. */
export type PackageKind = 'module' | 'system';

/** Who a handler is willing to hear from. */
export type SocketSender = 'gm' | 'anyone';

/** What a handler is told about the message it is running for. */
export interface SocketContext {
  /** The sending user, looked up from the id the server supplied. */
  readonly user: UserLike | undefined;
  /** That id. Empty string when this client sent the message itself. */
  readonly userId: string;
  /** True when this is the sender's own copy rather than a relayed message. */
  readonly local: boolean;
}

/** What runs when a message arrives. */
export type SocketMessageRun = (payload: never, context: SocketContext) => void | Promise<void>;

/**
 * One thing a package can be told to do.
 *
 * A bare function is the same as `{ run }`, which is what most handlers are.
 * Use the object form when the message may come from someone who is not a
 * Gamemaster.
 */
export type SocketMessageHandler =
  | SocketMessageRun
  | {
      /**
       * Who may trigger it. Default `'gm'`. `'anyone'` is for messages that
       * only touch the receiving client, and even then the handler is the
       * last line: the sender chose the payload.
       */
      readonly from?: SocketSender;
      readonly run: SocketMessageRun;
    };

/** What runs on the Gamemaster's client, and whose return value travels back. */
export type SocketRequestRun = (payload: never, context: SocketContext) => unknown;

/**
 * One thing a client can ask the GM's client to do on its behalf. A bare
 * function is the same as `{ run }`.
 */
export type SocketRequestHandler = SocketRequestRun | { readonly run: SocketRequestRun };

export interface SocketRegistration {
  /** Package id: the `id` in `module.json` or `system.json`. */
  readonly id: string;
  /** Which manifest that is. Decides `module.<id>` against `system.<id>`. */
  readonly kind: PackageKind;
  /** One-way messages, keyed by name. */
  readonly messages?: Readonly<Record<string, SocketMessageHandler>>;
  /** Questions for the GM's client, keyed by name. */
  readonly requests?: Readonly<Record<string, SocketRequestHandler>>;
}

export interface EmitOptions {
  /**
   * User ids to send to. Left out, every other client receives it. The
   * sender's own id is dropped from the list, because the local run below
   * already covers this client.
   */
  readonly to?: readonly string[];
  /**
   * Run the handler on this client as well. Default `true`, which is what
   * makes a lone GM see the same thing as a table full of players. `false`
   * when the sender must not act on its own message.
   */
  readonly self?: boolean;
}

export interface AskGmOptions {
  /** Milliseconds to wait for the GM's client. Foundry's default applies otherwise. */
  readonly timeout?: number;
}

/** What `registerSocket` hands back. */
export interface PackageSocket {
  /** The channel Foundry routes on: `module.<id>` or `system.<id>`. */
  readonly channel: string;
  /** Send a one-way message. Runs the handler here too, unless told not to. */
  emit(name: string, payload?: unknown, options?: EmitOptions): Promise<void>;
  /** Ask the GM's client to run a request, and wait for its answer. */
  askGm<T = unknown>(name: string, payload?: unknown, options?: AskGmOptions): Promise<T>;
  /** Is a Gamemaster connected right now? */
  isGmOnline(): boolean;
}

interface Envelope {
  readonly name: string;
  readonly payload: unknown;
}

function config(): FoundryConfig {
  return (globalThis as { CONFIG?: FoundryConfig }).CONFIG as FoundryConfig;
}

function game(): Game | undefined {
  return (globalThis as { game?: Game }).game;
}

function socketApi(): SocketApi | undefined {
  return game()?.socket ?? undefined;
}

function fail(code: 'VTTF-0012' | 'VTTF-0013', message: string): never {
  throw new VttfError(code, message);
}

/**
 * Is the package allowed to use its channel?
 *
 * Read from the manifest Foundry already parsed. Checking here turns the
 * silent version of this mistake into a message at registration, which is the
 * only moment anybody is looking.
 */
function assertSocketEnabled(id: string, kind: PackageKind): void {
  const g = game();
  if (!g) return;
  const declared =
    kind === 'system' ? g.system?.socket === true : g.modules?.get(id)?.socket === true;
  if (declared) return;
  fail(
    'VTTF-0012',
    `${kind} "${id}" registered socket handlers, but its manifest does not set "socket": true. ` +
      'Foundry accepts the emit and delivers nothing. Add the field to ' +
      `${kind === 'system' ? 'system.json' : 'module.json'} and reload the world.`,
  );
}

function assertNames(kind: string, names: readonly string[]): void {
  for (const name of names) {
    if (typeof name === 'string' && /^[A-Za-z][A-Za-z0-9_-]*$/.test(name)) continue;
    fail(
      'VTTF-0012',
      `Socket ${kind} name ${JSON.stringify(name)} is not usable. ` +
        'Names start with a letter and hold letters, digits, hyphens and underscores.',
    );
  }
}

/** Both handler shapes, read the same way. */
function runOf(
  handler: SocketMessageHandler | SocketRequestHandler,
): (payload: unknown, context: SocketContext) => unknown {
  const run = typeof handler === 'function' ? handler : handler.run;
  return run as (payload: unknown, context: SocketContext) => unknown;
}

function senderOf(handler: SocketMessageHandler): SocketSender {
  if (typeof handler === 'function') return 'gm';
  return handler.from ?? 'gm';
}

function isEnvelope(message: unknown): message is Envelope {
  return (
    typeof message === 'object' &&
    message !== null &&
    typeof (message as { name?: unknown }).name === 'string'
  );
}

const registered = new Set<string>();

/** For tests: clears the in-process "already registered" guard. */
export function _resetRegisteredSocketsForTests(): void {
  registered.clear();
}

/**
 * Register a package's socket handlers and get the two send functions back.
 *
 * Call it once, from `onSetup` or `onReady`. Registering twice means every
 * message runs its handler twice, which Foundry will not warn about.
 */
export function registerSocket(registration: SocketRegistration): PackageSocket {
  const { id, kind } = registration;
  if (typeof id !== 'string' || id === '') {
    fail('VTTF-0012', 'registerSocket() needs the package id.');
  }
  if (kind !== 'module' && kind !== 'system') {
    fail('VTTF-0012', `registerSocket() kind must be "module" or "system", got ${String(kind)}.`);
  }

  const messages = registration.messages ?? {};
  const requests = registration.requests ?? {};
  assertNames('message', Object.keys(messages));
  assertNames('request', Object.keys(requests));
  if (Object.keys(messages).length === 0 && Object.keys(requests).length === 0) {
    fail('VTTF-0012', `registerSocket() for "${id}" was given no messages and no requests.`);
  }

  const channel = `${kind}.${id}`;
  if (registered.has(channel)) {
    fail(
      'VTTF-0012',
      `Socket handlers for "${channel}" are already registered. Call registerSocket() once.`,
    );
  }

  if (Object.keys(messages).length > 0) assertSocketEnabled(id, kind);

  /** The id the server gave us, or nothing. Never read from the payload. */
  function contextFor(senderId: unknown, local: boolean): SocketContext | undefined {
    if (local) {
      const own = game()?.userId ?? '';
      return { user: own ? game()?.users?.get(own) : undefined, userId: own, local: true };
    }
    if (typeof senderId !== 'string' || senderId === '') return undefined;
    const user = game()?.users?.get(senderId);
    if (!user) return undefined;
    return { user, userId: senderId, local: false };
  }

  function allowed(handler: SocketMessageHandler, context: SocketContext): boolean {
    if (senderOf(handler) === 'anyone') return true;
    return context.user?.isGM === true;
  }

  async function run(name: string, payload: unknown, context: SocketContext): Promise<void> {
    const handler = messages[name];
    if (!handler || !allowed(handler, context)) return;
    await runOf(handler)(payload, context);
  }

  socketApi()?.on(channel, (message, senderId) => {
    if (!isEnvelope(message)) return;
    const context = contextFor(senderId, false);
    if (!context) return;
    void run(message.name, message.payload, context);
  });

  // Requests live in `CONFIG.queries`, which is one flat namespace shared by
  // everything installed, so every name carries the package id.
  const queries = config()?.queries;
  if (queries) {
    for (const [name, handler] of Object.entries(requests)) {
      const run = runOf(handler);
      queries[`${id}.${name}`] = (data, { user }) => {
        const context: SocketContext = { user, userId: user?.id ?? '', local: false };
        return run(data, context);
      };
    }
  }

  registered.add(channel);

  function isGmOnline(): boolean {
    return Boolean(game()?.users?.find((user) => user.isGM === true && user.active === true));
  }

  return {
    channel,

    async emit(name, payload, options = {}) {
      if (!messages[name]) {
        fail('VTTF-0012', `"${name}" is not a message registered for "${channel}".`);
      }
      const envelope: Envelope = { name, payload };
      const own = game()?.userId ?? '';
      if (options.to === undefined) {
        socketApi()?.emit(channel, envelope);
      } else {
        const others = options.to.filter((userId) => userId !== own);
        if (others.length > 0) socketApi()?.emit(channel, envelope, { recipients: others });
      }
      if (options.self === false) return;
      if (options.to !== undefined && !options.to.includes(own)) return;
      const context = contextFor(undefined, true);
      if (context) await run(name, payload, context);
    },

    async askGm<T>(name: string, payload?: unknown, options: AskGmOptions = {}): Promise<T> {
      const handler = requests[name];
      if (!handler) {
        fail('VTTF-0013', `"${name}" is not a request registered for "${channel}".`);
      }
      const g = game();
      // A GM asking the GM is just a call. No round trip, and it still works
      // in a world where this GM is the only one connected.
      if (g?.user?.isGM === true) {
        const own = g.userId ?? '';
        const context: SocketContext = {
          user: own ? g.users?.get(own) : undefined,
          userId: own,
          local: true,
        };
        return (await runOf(handler)(payload, context)) as T;
      }
      const gm = g?.users?.find((user) => user.isGM === true && user.active === true);
      if (!gm?.query) {
        fail(
          'VTTF-0013',
          `No Gamemaster is connected, so "${name}" cannot run. ` +
            'A player cannot write to world documents; a GM has to be online.',
        );
      }
      return (await gm.query(
        `${id}.${name}`,
        payload,
        options.timeout === undefined ? undefined : { timeout: options.timeout },
      )) as T;
    },

    isGmOnline,
  };
}
