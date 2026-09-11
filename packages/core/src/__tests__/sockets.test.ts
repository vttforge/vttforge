import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { _resetRegisteredSocketsForTests, registerSocket } from '../sockets.js';

interface FakeUser {
  id: string;
  name: string;
  isGM: boolean;
  active: boolean;
  query?: ReturnType<typeof vi.fn>;
}

const GM: FakeUser = { id: 'gm1', name: 'Gamemaster', isGM: true, active: true };
const PLAYER: FakeUser = { id: 'p1', name: 'Player', isGM: false, active: true };
const OTHER: FakeUser = { id: 'p2', name: 'Other', isGM: false, active: true };

let listeners: Array<(message: unknown, senderId?: unknown) => void>;
let emitted: Array<{ channel: string; message: unknown; options?: unknown }>;
let users: FakeUser[];

/** Build the globals a package sees, as the user given. */
function world(
  self: FakeUser,
  { socket = true, kind = 'module' as 'module' | 'system' } = {},
): void {
  listeners = [];
  emitted = [];
  users = [GM, PLAYER, OTHER];
  (globalThis as Record<string, unknown>).CONFIG = { queries: {} };
  (globalThis as Record<string, unknown>).game = {
    user: { isGM: self.isGM },
    userId: self.id,
    users: {
      get: (id: string) => users.find((user) => user.id === id),
      find: (fn: (user: FakeUser) => boolean) => users.find(fn),
      filter: (fn: (user: FakeUser) => boolean) => users.filter(fn),
    },
    socket: {
      emit: (channel: string, message: unknown, options?: unknown) => {
        emitted.push({ channel, message, options });
      },
      on: (_channel: string, listener: (message: unknown, senderId?: unknown) => void) => {
        listeners.push(listener);
      },
    },
    system: { id: 'my-system', socket: kind === 'system' ? socket : false },
    modules: { get: () => (kind === 'module' ? { socket } : undefined) },
  };
}

/** Deliver a message the way Foundry does: payload first, server's sender id second. */
async function relay(message: unknown, senderId: unknown): Promise<void> {
  for (const listener of listeners) listener(message, senderId);
  await Promise.resolve();
}

/** The `recipients` of the one message that was sent. */
function recipients(): readonly string[] | undefined {
  const options = emitted.at(0)?.options as { recipients?: readonly string[] } | undefined;
  return options?.recipients;
}

function queries(): Record<string, (data: unknown, context: unknown) => unknown> {
  return (globalThis as { CONFIG: { queries: Record<string, never> } }).CONFIG.queries;
}

beforeEach(() => {
  _resetRegisteredSocketsForTests();
  world(GM);
});

afterEach(() => {
  (globalThis as Record<string, unknown>).game = undefined;
  (globalThis as Record<string, unknown>).CONFIG = undefined;
  delete GM.query;
  delete PLAYER.query;
});

describe('registering', () => {
  it('names the channel after the manifest the package is declared in', () => {
    const module = registerSocket({
      id: 'my-module',
      kind: 'module',
      messages: { ping: { run: () => {} } },
    });
    expect(module.channel).toBe('module.my-module');

    _resetRegisteredSocketsForTests();
    world(GM, { kind: 'system' });
    const system = registerSocket({
      id: 'my-system',
      kind: 'system',
      messages: { ping: { run: () => {} } },
    });
    expect(system.channel).toBe('system.my-system');
  });

  it('refuses a package whose manifest has no socket field', () => {
    world(GM, { socket: false });
    expect(() =>
      registerSocket({ id: 'my-module', kind: 'module', messages: { ping: { run: () => {} } } }),
    ).toThrow(/VTTF-0012[\s\S]*"socket": true/);
  });

  it('registers requests without needing the socket field, since a query is not the socket', () => {
    world(GM, { socket: false });
    expect(() =>
      registerSocket({ id: 'my-module', kind: 'module', requests: { grant: { run: () => 1 } } }),
    ).not.toThrow();
    expect(Object.keys(queries())).toEqual(['my-module.grant']);
  });

  it('refuses a second registration for the same channel', () => {
    const register = () =>
      registerSocket({ id: 'my-module', kind: 'module', messages: { ping: { run: () => {} } } });
    register();
    expect(register).toThrow(/already registered/);
  });

  it('refuses an empty registration, a bad kind and an unusable name', () => {
    expect(() => registerSocket({ id: 'my-module', kind: 'module' })).toThrow(
      /no messages and no requests/,
    );
    expect(() =>
      registerSocket({
        id: 'my-module',
        kind: 'plugin' as never,
        messages: { ping: { run: () => {} } },
      }),
    ).toThrow(/"module" or "system"/);
    expect(() =>
      registerSocket({ id: 'my-module', kind: 'module', messages: { '2fast': { run: () => {} } } }),
    ).toThrow(/not usable/);
  });
});

describe('a bare function handler', () => {
  it('is the same as { run }, and defaults to Gamemaster only', async () => {
    const run = vi.fn();
    world(PLAYER);
    registerSocket({
      id: 'my-module',
      kind: 'module',
      messages: { turn: run },
      requests: { grant: () => 'ok' },
    });
    await relay({ name: 'turn', payload: 1 }, GM.id);
    expect(run).toHaveBeenCalledTimes(1);
    await relay({ name: 'turn', payload: 2 }, OTHER.id);
    expect(run).toHaveBeenCalledTimes(1);
    expect(queries()['my-module.grant']?.(null, {})).toBe('ok');
  });
});

describe('a message arriving from another client', () => {
  it('runs for a Gamemaster and is dropped for a player', async () => {
    const run = vi.fn();
    world(PLAYER);
    registerSocket({ id: 'my-module', kind: 'module', messages: { turn: { run } } });

    await relay({ name: 'turn', payload: { page: 3 } }, GM.id);
    expect(run).toHaveBeenCalledTimes(1);
    const [payload, context] = run.mock.calls[0] as [
      { page: number },
      { userId: string; local: boolean },
    ];
    expect(payload).toEqual({ page: 3 });
    expect(context.userId).toBe(GM.id);
    expect(context.local).toBe(false);

    await relay({ name: 'turn', payload: { page: 4 } }, OTHER.id);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('runs for anyone when the handler says so', async () => {
    const run = vi.fn();
    world(PLAYER);
    registerSocket({
      id: 'my-module',
      kind: 'module',
      messages: { warm: { from: 'anyone', run } },
    });
    await relay({ name: 'warm', payload: null }, OTHER.id);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('drops a message with no sender id, an unknown sender, or a sender in the payload', async () => {
    const run = vi.fn();
    world(PLAYER);
    registerSocket({ id: 'my-module', kind: 'module', messages: { turn: { run } } });

    await relay({ name: 'turn', payload: null }, undefined);
    await relay({ name: 'turn', payload: null }, 'nobody');
    // The one that matters: a payload claiming to come from the GM, relayed
    // by a player. The server's id is what decides, so this is dropped.
    await relay({ name: 'turn', payload: { userId: GM.id } }, PLAYER.id);
    expect(run).not.toHaveBeenCalled();
  });

  it('ignores a message that is not ours and a name nobody registered', async () => {
    const run = vi.fn();
    registerSocket({ id: 'my-module', kind: 'module', messages: { turn: { run } } });
    await relay('not an envelope', GM.id);
    await relay({ name: 'unknown', payload: null }, GM.id);
    expect(run).not.toHaveBeenCalled();
  });
});

describe('emitting', () => {
  it('broadcasts and runs on the sender, because Foundry does not deliver to the sender', async () => {
    const run = vi.fn();
    const socket = registerSocket({
      id: 'my-module',
      kind: 'module',
      messages: { turn: { run } },
    });
    await socket.emit('turn', { page: 2 });

    expect(emitted).toEqual([
      {
        channel: 'module.my-module',
        message: { name: 'turn', payload: { page: 2 } },
        options: undefined,
      },
    ]);
    expect(run).toHaveBeenCalledTimes(1);
    expect((run.mock.calls[0] as [unknown, { local: boolean }])[1].local).toBe(true);
  });

  it('routes to named users and drops the sender from the list', async () => {
    const run = vi.fn();
    const socket = registerSocket({
      id: 'my-module',
      kind: 'module',
      messages: { turn: { run } },
    });
    await socket.emit('turn', null, { to: [GM.id, PLAYER.id] });

    // The sender is in `to`, so it acts locally and is not also sent to.
    expect(recipients()).toEqual([PLAYER.id]);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('does not run locally when the sender is not a recipient', async () => {
    const run = vi.fn();
    const socket = registerSocket({
      id: 'my-module',
      kind: 'module',
      messages: { turn: { run } },
    });
    await socket.emit('turn', null, { to: [PLAYER.id] });
    expect(recipients()).toEqual([PLAYER.id]);
    expect(run).not.toHaveBeenCalled();
  });

  it('sends nothing when the only recipient is the sender, and still acts locally', async () => {
    const run = vi.fn();
    const socket = registerSocket({
      id: 'my-module',
      kind: 'module',
      messages: { turn: { run } },
    });
    await socket.emit('turn', null, { to: [GM.id] });
    expect(emitted).toEqual([]);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('skips the local run when asked, and refuses an unregistered name', async () => {
    const run = vi.fn();
    const socket = registerSocket({
      id: 'my-module',
      kind: 'module',
      messages: { turn: { run } },
    });
    await socket.emit('turn', null, { self: false });
    expect(emitted).toHaveLength(1);
    expect(run).not.toHaveBeenCalled();
    await expect(socket.emit('nope')).rejects.toThrow(/not a message registered/);
  });
});

describe('asking the Gamemaster', () => {
  it('runs the handler directly when the asker is the Gamemaster', async () => {
    const run = vi.fn(() => 'done');
    const socket = registerSocket({
      id: 'my-module',
      kind: 'module',
      requests: { grant: { run } },
    });
    await expect(socket.askGm('grant', { itemId: 'x' })).resolves.toBe('done');
    expect(run).toHaveBeenCalledWith({ itemId: 'x' }, expect.objectContaining({ local: true }));
  });

  it('queries a connected Gamemaster when the asker is a player', async () => {
    world(PLAYER);
    GM.query = vi.fn(async () => 'granted');
    const socket = registerSocket({
      id: 'my-module',
      kind: 'module',
      requests: { grant: { run: () => 'never here' } },
    });
    await expect(socket.askGm('grant', { itemId: 'x' }, { timeout: 5000 })).resolves.toBe(
      'granted',
    );
    expect(GM.query).toHaveBeenCalledWith('my-module.grant', { itemId: 'x' }, { timeout: 5000 });
  });

  it('says so when no Gamemaster is connected', async () => {
    world(PLAYER);
    users = [PLAYER, { ...GM, active: false }];
    const socket = registerSocket({
      id: 'my-module',
      kind: 'module',
      requests: { grant: { run: () => 1 } },
    });
    await expect(socket.askGm('grant')).rejects.toThrow(/VTTF-0013[\s\S]*No Gamemaster/);
    expect(socket.isGmOnline()).toBe(false);
  });

  it('registers the handler under the package id, and names the asker', async () => {
    registerSocket({
      id: 'my-module',
      kind: 'module',
      requests: { grant: { run: (_payload, context) => context.user?.name } },
    });
    const handler = queries()['my-module.grant'];
    expect(handler).toBeTypeOf('function');
    expect(handler?.(null, { user: PLAYER })).toBe('Player');
  });

  it('refuses a request nobody registered', async () => {
    const socket = registerSocket({
      id: 'my-module',
      kind: 'module',
      requests: { grant: { run: () => 1 } },
    });
    await expect(socket.askGm('nope')).rejects.toThrow(/not a request registered/);
  });
});
