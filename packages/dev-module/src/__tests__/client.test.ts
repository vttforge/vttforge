import { describe, expect, it, vi } from 'vitest';
import { connect, parsePayload, type SocketLike } from '../client.js';
import type { FoundryEnv } from '../reload.js';

/** A socket whose events the test fires by hand. */
function fakeSocket() {
  const listeners = new Map<string, Array<(event: { data?: unknown }) => void>>();
  const socket: SocketLike & {
    fire: (t: string, e?: { data?: unknown }) => void;
    closed: boolean;
  } = {
    addEventListener: (type, listener) => {
      const list = listeners.get(type) ?? [];
      list.push(listener);
      listeners.set(type, list);
    },
    close: () => {
      socket.closed = true;
    },
    fire: (type, event = {}) => {
      for (const l of listeners.get(type) ?? []) l(event);
    },
    closed: false,
  };
  return socket;
}

const env = { callHook: () => false } as unknown as FoundryEnv;

describe('parsePayload', () => {
  it('reads a well-formed frame and lowercases the extension', () => {
    const raw = JSON.stringify({
      packageType: 'system',
      packageId: 'my-system',
      content: 'body{}',
      path: 'systems/my-system/styles/main.css',
      extension: 'CSS',
    });
    expect(parsePayload(raw)?.extension).toBe('css');
  });

  it.each([
    ['not json at all'],
    [JSON.stringify({ path: 'a' })],
    [JSON.stringify({ path: 'a', content: 'b', extension: 'css' })],
    [JSON.stringify({ path: 1, content: 'b', extension: 'css', packageId: 'x' })],
  ])('drops a frame it cannot trust: %j', (raw) => {
    expect(parsePayload(raw)).toBeNull();
  });

  it.each([[null], [undefined], [42], [{}]])('drops a non-string frame: %j', (raw) => {
    expect(parsePayload(raw)).toBeNull();
  });

  it('defaults an unrecognised packageType to system rather than dropping the frame', () => {
    const raw = JSON.stringify({
      packageType: 'nonsense',
      packageId: 'my-system',
      content: '',
      path: 'a.css',
      extension: 'css',
    });
    expect(parsePayload(raw)?.packageType).toBe('system');
  });
});

describe('connect', () => {
  it('reconnects with backoff after the socket closes', () => {
    const sockets: ReturnType<typeof fakeSocket>[] = [];
    const timers: Array<{ fn: () => void; ms: number }> = [];
    connect({
      url: 'ws://localhost:31313',
      env,
      createSocket: () => {
        const s = fakeSocket();
        sockets.push(s);
        return s;
      },
      setTimer: (fn, ms) => timers.push({ fn, ms }),
      log: () => undefined,
      retryDelays: [10, 20, 40],
    });

    sockets[0]?.fire('close');
    expect(timers[0]?.ms).toBe(10);
    timers[0]?.fn();

    sockets[1]?.fire('close');
    expect(timers[1]?.ms).toBe(20);
  });

  it('holds at the final delay instead of growing without bound', () => {
    const sockets: ReturnType<typeof fakeSocket>[] = [];
    const timers: Array<{ fn: () => void; ms: number }> = [];
    connect({
      url: 'ws://x',
      env,
      createSocket: () => {
        const s = fakeSocket();
        sockets.push(s);
        return s;
      },
      setTimer: (fn, ms) => timers.push({ fn, ms }),
      log: () => undefined,
      retryDelays: [10, 20],
    });

    for (let i = 0; i < 4; i += 1) {
      sockets[i]?.fire('close');
      timers[i]?.fn();
    }
    expect(timers.at(-1)?.ms).toBe(20);
  });

  it('resets the backoff once a connection succeeds', () => {
    const sockets: ReturnType<typeof fakeSocket>[] = [];
    const timers: Array<{ fn: () => void; ms: number }> = [];
    connect({
      url: 'ws://x',
      env,
      createSocket: () => {
        const s = fakeSocket();
        sockets.push(s);
        return s;
      },
      setTimer: (fn, ms) => timers.push({ fn, ms }),
      log: () => undefined,
      retryDelays: [10, 20, 40],
    });

    sockets[0]?.fire('close');
    timers[0]?.fn();
    sockets[1]?.fire('open');
    sockets[1]?.fire('close');
    expect(timers[1]?.ms).toBe(10);
  });

  it('stops reconnecting once told to stop', () => {
    const sockets: ReturnType<typeof fakeSocket>[] = [];
    const timers: Array<{ fn: () => void; ms: number }> = [];
    const conn = connect({
      url: 'ws://x',
      env,
      createSocket: () => {
        const s = fakeSocket();
        sockets.push(s);
        return s;
      },
      setTimer: (fn, ms) => timers.push({ fn, ms }),
      log: () => undefined,
    });

    conn.stop();
    expect(sockets[0]?.closed).toBe(true);
    sockets[0]?.fire('close');
    expect(timers).toHaveLength(0);
  });

  it('survives a malformed frame rather than dropping the connection', () => {
    const sockets: ReturnType<typeof fakeSocket>[] = [];
    connect({
      url: 'ws://x',
      env,
      createSocket: () => {
        const s = fakeSocket();
        sockets.push(s);
        return s;
      },
      setTimer: () => undefined,
      log: () => undefined,
    });

    expect(() => sockets[0]?.fire('message', { data: '{{{' })).not.toThrow();
  });

  it('reports a payload it could not apply, but stays quiet about a veto', () => {
    const sockets: ReturnType<typeof fakeSocket>[] = [];
    const log = vi.fn();
    connect({
      url: 'ws://x',
      env,
      createSocket: () => {
        const s = fakeSocket();
        sockets.push(s);
        return s;
      },
      setTimer: () => undefined,
      log,
    });

    const frame = JSON.stringify({
      packageType: 'system',
      packageId: 'my-system',
      content: '',
      path: 'a.css',
      extension: 'css',
    });
    sockets[0]?.fire('message', { data: frame });
    // env vetoes, so nothing beyond the initial connect message is logged
    expect(log.mock.calls.flat()).not.toContain('could not reload a.css (no-match)');
  });
});
