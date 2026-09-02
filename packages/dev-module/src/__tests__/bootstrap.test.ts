import { describe, expect, it, vi } from 'vitest';
import { bootstrap, buildEnv, DEFAULT_PORT, resolveServerUrl } from '../bootstrap.js';

function foundryGlobals(over: Record<string, unknown> = {}) {
  return {
    game: { i18n: { lang: 'en', translations: {} } },
    Handlebars: { compile: () => ({}), registerPartial: () => undefined },
    Hooks: { call: () => true },
    foundry: { utils: { mergeObject: (t: object) => t }, applications: { instances: new Map() } },
    ui: { windows: {} },
    document: globalThis.document,
    ...over,
  };
}

describe('resolveServerUrl', () => {
  it.each([['localhost'], ['127.0.0.1'], ['[::1]']])(
    'keeps %s as-is when Foundry is served locally',
    (hostname) => {
      expect(resolveServerUrl(hostname)).toBe(`ws://${hostname}:${DEFAULT_PORT}`);
    },
  );

  it('reaches back to the host when Foundry is not local — the container case', () => {
    expect(resolveServerUrl('192.168.1.40')).toBe(`ws://host.docker.internal:${DEFAULT_PORT}`);
  });

  it('honours an explicit override over any guess', () => {
    expect(resolveServerUrl('192.168.1.40', 1234, 'ws://elsewhere:9999')).toBe(
      'ws://elsewhere:9999',
    );
  });

  it('uses the port it is given', () => {
    expect(resolveServerUrl('localhost', 4000)).toBe('ws://localhost:4000');
  });
});

describe('buildEnv', () => {
  it('builds an environment from Foundry globals', () => {
    const env = buildEnv({
      globals: foundryGlobals(),
      location: { hostname: 'localhost' },
      createSocket: () => ({ addEventListener: () => undefined, close: () => undefined }),
      setTimer: () => undefined,
      log: () => undefined,
    });
    expect(env).not.toBeNull();
    expect(env?.callHook('hotReload', {} as never)).toBe(true);
  });

  it.each([['game'], ['Handlebars'], ['Hooks'], ['foundry'], ['document']])(
    'returns null when %s is missing',
    (missing) => {
      const globals = foundryGlobals();
      delete (globals as Record<string, unknown>)[missing];
      const env = buildEnv({
        globals,
        location: { hostname: 'localhost' },
        createSocket: () => ({ addEventListener: () => undefined, close: () => undefined }),
        setTimer: () => undefined,
        log: () => undefined,
      });
      expect(env).toBeNull();
    },
  );
});

describe('bootstrap', () => {
  it('does not connect outside Foundry, and says so', () => {
    const log = vi.fn();
    const createSocket = vi.fn();
    const result = bootstrap({
      globals: {},
      location: { hostname: 'localhost' },
      createSocket,
      setTimer: () => undefined,
      log,
    });
    expect(result).toBeNull();
    expect(createSocket).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith('Foundry globals are not available; not connecting.');
  });

  it('connects to the resolved address inside Foundry', () => {
    const createSocket = vi.fn(() => ({
      addEventListener: () => undefined,
      close: () => undefined,
    }));
    const conn = bootstrap({
      globals: foundryGlobals(),
      location: { hostname: 'localhost' },
      createSocket,
      setTimer: () => undefined,
      log: () => undefined,
    });
    expect(conn).not.toBeNull();
    expect(createSocket).toHaveBeenCalledWith(`ws://localhost:${DEFAULT_PORT}`);
  });
});
