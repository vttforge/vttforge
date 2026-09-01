/**
 * Foundry entry point. Loaded by `module.json`, runs in the browser.
 *
 * Everything of substance lives in `bootstrap`; this file only supplies the
 * real globals, the real socket, and the real timer.
 */
import { bootstrap, MODULE_ID } from './bootstrap.js';

const PREFIX = `${MODULE_ID} |`;

Hooks.once('ready', () => {
  const override = (globalThis as Record<string, unknown>).VTTFORGE_DEV_SERVER_URL ?? null;
  bootstrap({
    globals: globalThis as unknown as Record<string, unknown>,
    location: globalThis.location,
    createSocket: (url) => new WebSocket(url),
    setTimer: (fn, ms) => globalThis.setTimeout(fn, ms),
    log: (message, ...rest) => console.info(PREFIX, message, ...rest),
    override: typeof override === 'string' ? override : null,
  });
});

declare const Hooks: { once: (name: string, fn: () => void) => void };
