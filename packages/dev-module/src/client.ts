/**
 * The WebSocket client.
 *
 * `vttforge dev` runs `vite build --watch`, which has no server of its own,
 * so the CLI stands up a small socket and pushes a payload per changed file.
 * This end listens and applies it.
 *
 * The socket is expected to disappear often (the CLI stops between runs, the
 * developer restarts it), so a dropped connection is normal, not an error, and
 * reconnection backs off rather than hammering a port nobody is listening on.
 */
import { applyHotReload, type FoundryEnv, type HotReloadData } from './reload.js';

export interface ClientOptions {
  url: string;
  env: FoundryEnv;
  /** Injected so tests do not need a real WebSocket. */
  createSocket: (url: string) => SocketLike;
  /** Injected so tests do not wait in real time. */
  setTimer: (fn: () => void, ms: number) => unknown;
  log: (message: string, ...rest: unknown[]) => void;
  /** Backoff schedule in ms; the last value repeats. */
  retryDelays?: readonly number[];
}

/** The slice of WebSocket this module uses. */
export interface SocketLike {
  addEventListener: (type: string, listener: (event: { data?: unknown }) => void) => void;
  close: () => void;
}

const DEFAULT_RETRY_DELAYS = [500, 1000, 2000, 5000] as const;

export interface Connection {
  /** Stop reconnecting and drop the current socket. */
  stop: () => void;
}

export function connect(options: ClientOptions): Connection {
  const retryDelays = options.retryDelays ?? DEFAULT_RETRY_DELAYS;
  let attempt = 0;
  let stopped = false;
  let socket: SocketLike | null = null;

  const open = (): void => {
    if (stopped) return;
    socket = options.createSocket(options.url);

    socket.addEventListener('open', () => {
      attempt = 0;
      options.log('connected to the dev server');
    });

    socket.addEventListener('message', (event) => {
      const data = parsePayload(event.data);
      if (!data) return;
      const outcome = applyHotReload(data, options.env);
      if (outcome.applied) {
        options.log(`reloaded ${data.path}`);
      } else if (outcome.reason !== 'vetoed') {
        // A veto is somebody's deliberate choice; the rest mean the payload
        // arrived but nothing on the page matched it, which is worth saying
        // out loud rather than failing silently.
        options.log(`could not reload ${data.path} (${outcome.reason})`);
      }
    });

    socket.addEventListener('close', () => {
      socket = null;
      if (stopped) return;
      const delay = retryDelays[Math.min(attempt, retryDelays.length - 1)] ?? 5000;
      attempt += 1;
      options.setTimer(open, delay);
    });

    // A failed connection also emits `close`, so reconnection is handled
    // there. Swallowing `error` keeps a routine "nothing listening yet" out
    // of the console as an uncaught event.
    socket.addEventListener('error', () => undefined);
  };

  open();

  return {
    stop: () => {
      stopped = true;
      socket?.close();
      socket = null;
    },
  };
}

/**
 * Read one frame.
 *
 * The payload crosses a process boundary, so nothing about its shape is
 * assumed. A malformed frame is dropped rather than allowed to throw inside
 * the socket listener, where it would take the connection down with it.
 */
export function parsePayload(raw: unknown): HotReloadData | null {
  if (typeof raw !== 'string') return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const p = parsed as Record<string, unknown>;
  if (
    typeof p.path !== 'string' ||
    typeof p.content !== 'string' ||
    typeof p.extension !== 'string' ||
    typeof p.packageId !== 'string'
  ) {
    return null;
  }
  const packageType =
    p.packageType === 'system' || p.packageType === 'module' || p.packageType === 'world'
      ? p.packageType
      : 'system';
  return {
    packageType,
    packageId: p.packageId,
    content: p.content,
    path: p.path,
    extension: p.extension.toLowerCase(),
  };
}
