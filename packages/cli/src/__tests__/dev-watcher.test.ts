import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reloadableExtension, servedPath, watchDist } from '../dev-watcher.js';

describe('servedPath', () => {
  it('places a system file under /systems/<id>/', () => {
    expect(servedPath('styles/main.css', 'my-system', 'system')).toBe(
      'systems/my-system/styles/main.css',
    );
  });

  it('places a module file under /modules/<id>/', () => {
    expect(servedPath('lang/en.json', 'my-module', 'module')).toBe(
      'modules/my-module/lang/en.json',
    );
  });

  it('emits forward slashes even from a Windows-style relative path', () => {
    // The result becomes a URL; a backslash would not match the rendered link.
    expect(servedPath('templates\\actor\\sheet.hbs'.split('\\').join('/'), 'x', 'system')).toBe(
      'systems/x/templates/actor/sheet.hbs',
    );
  });
});

describe('reloadableExtension', () => {
  it.each([
    ['styles/main.css', 'css'],
    ['templates/a.hbs', 'hbs'],
    ['templates/a.HTML', 'html'],
    ['lang/en.JSON', 'json'],
  ])('accepts %s as %s', (file, expected) => {
    expect(reloadableExtension(file)).toBe(expected);
  });

  it.each([['main.mjs'], ['main.mjs.map'], ['assets/logo.png'], ['README']])(
    'ignores %s, which cannot be applied without a reload',
    (file) => {
      expect(reloadableExtension(file)).toBeNull();
    },
  );
});

describe('watchDist', () => {
  let dist: string;

  beforeEach(async () => {
    dist = mkdtempSync(join(tmpdir(), 'vttforge-watch-'));
    await mkdir(join(dist, 'styles'), { recursive: true });
  });

  afterEach(() => {
    rmSync(dist, { recursive: true, force: true });
  });

  const settle = (ms = 120) => new Promise((r) => setTimeout(r, ms));

  /**
   * Give a freshly created watcher a moment to register.
   *
   * A recursive `fs.watch` is not listening the instant it returns, and a
   * write in the same tick is simply missed. That is what made these tests
   * flaky: not a sleep too short to cover the debounce, but a payload that
   * never came. It also made the negative cases pass for the wrong reason —
   * a watcher that is not yet listening stays quiet about everything.
   */
  const ready = () => settle(80);

  /**
   * Wait until a payload count is reached, or give up.
   *
   * A fixed sleep is the wrong tool for "the watcher should have fired by
   * now": it has to cover a filesystem event plus a debounce, and under a
   * loaded parallel suite that budget runs out. Polling returns as soon as
   * the event lands and tolerates a slow machine.
   *
   * Cases that assert a payload never arrives still sleep — there is nothing
   * to poll for, and the wait is the test.
   */
  const waitForCalls = async (fn: { mock: { calls: unknown[] } }, count = 1, timeoutMs = 3000) => {
    const deadline = Date.now() + timeoutMs;
    while (fn.mock.calls.length < count) {
      if (Date.now() > deadline) return false;
      await settle(10);
    }
    return true;
  };

  it('emits a payload the dev module can read', async () => {
    const onPayload = vi.fn();
    const watcher = watchDist({
      distDir: dist,
      packageId: 'my-system',
      packageType: 'system',
      onPayload,
      debounceMs: 10,
    });
    await ready();

    await writeFile(join(dist, 'styles', 'main.css'), 'body { color: red; }', 'utf8');
    expect(await waitForCalls(onPayload)).toBe(true);
    watcher.close();

    const frame = JSON.parse(onPayload.mock.calls.at(-1)?.[0] as string);
    expect(frame).toMatchObject({
      packageType: 'system',
      packageId: 'my-system',
      path: 'systems/my-system/styles/main.css',
      extension: 'css',
      content: 'body { color: red; }',
    });
  });

  it('stays quiet for a file it cannot apply in place', async () => {
    const onPayload = vi.fn();
    const watcher = watchDist({
      distDir: dist,
      packageId: 'my-system',
      packageType: 'system',
      onPayload,
      debounceMs: 10,
    });
    await ready();

    await writeFile(join(dist, 'main.mjs'), 'export {};', 'utf8');
    await settle();
    watcher.close();

    expect(onPayload).not.toHaveBeenCalled();
  });

  it('collapses a burst of writes into one payload', async () => {
    const onPayload = vi.fn();
    const watcher = watchDist({
      distDir: dist,
      packageId: 'my-system',
      packageType: 'system',
      onPayload,
      debounceMs: 60,
    });
    await ready();

    // Written synchronously and back to back: this is what an editor's save
    // looks like — write, truncate, rename — not three separate edits. An
    // awaited loop would space them out and stop being a burst at all.
    const file = join(dist, 'styles', 'main.css');
    for (const value of ['a', 'b', 'c']) {
      writeFileSync(file, `body{content:"${value}"}`, 'utf8');
    }
    expect(await waitForCalls(onPayload)).toBe(true);
    // One debounce window past the first payload: anything the burst failed
    // to merge would have arrived by now.
    await settle(140);
    watcher.close();

    expect(onPayload).toHaveBeenCalledTimes(1);
    expect(JSON.parse(onPayload.mock.calls[0]?.[0] as string).content).toContain('"c"');
  });

  it('sends again for a later, separate edit', async () => {
    const onPayload = vi.fn();
    const watcher = watchDist({
      distDir: dist,
      packageId: 'my-system',
      packageType: 'system',
      onPayload,
      debounceMs: 20,
    });
    await ready();

    const file = join(dist, 'styles', 'main.css');
    writeFileSync(file, 'body{content:"first"}', 'utf8');
    expect(await waitForCalls(onPayload)).toBe(true);
    writeFileSync(file, 'body{content:"second"}', 'utf8');
    expect(await waitForCalls(onPayload, 2)).toBe(true);
    watcher.close();

    // Debouncing must not swallow the next edit — it only merges one burst.
    expect(onPayload.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(JSON.parse(onPayload.mock.calls.at(-1)?.[0] as string).content).toContain('"second"');
  });

  it('stays quiet when a rebuild rewrites a file without changing it', async () => {
    // Vite rewrites its whole output every build. Without this, one edited
    // template would also resend the language file, and the JSON path
    // redraws every open window — undoing the scoped re-render entirely.
    const file = join(dist, 'styles', 'main.css');
    writeFileSync(file, 'body{color:red}', 'utf8');

    const onPayload = vi.fn();
    const watcher = watchDist({
      distDir: dist,
      packageId: 'my-system',
      packageType: 'system',
      onPayload,
      debounceMs: 20,
    });
    await settle(80);

    writeFileSync(file, 'body{color:red}', 'utf8');
    await settle(120);
    watcher.close();

    expect(onPayload).not.toHaveBeenCalled();
  });

  it('still sends when the content really changed', async () => {
    const file = join(dist, 'styles', 'main.css');
    writeFileSync(file, 'body{color:red}', 'utf8');

    const onPayload = vi.fn();
    const watcher = watchDist({
      distDir: dist,
      packageId: 'my-system',
      packageType: 'system',
      onPayload,
      debounceMs: 20,
    });
    await settle(80);

    writeFileSync(file, 'body{color:blue}', 'utf8');
    expect(await waitForCalls(onPayload)).toBe(true);
    watcher.close();

    expect(JSON.parse(onPayload.mock.calls.at(-1)?.[0] as string).content).toContain('blue');
  });

  it('emits nothing more once closed', async () => {
    const onPayload = vi.fn();
    const watcher = watchDist({
      distDir: dist,
      packageId: 'my-system',
      packageType: 'system',
      onPayload,
      debounceMs: 10,
    });
    // Let it come up first: closing a watcher that was never listening
    // would satisfy this test without testing close() at all.
    await ready();
    watcher.close();

    await writeFile(join(dist, 'styles', 'main.css'), 'body{}', 'utf8');
    await settle();
    expect(onPayload).not.toHaveBeenCalled();
  });

  it('reports a missing directory instead of throwing', async () => {
    const onError = vi.fn();
    const watcher = watchDist({
      distDir: join(dist, 'does-not-exist'),
      packageId: 'x',
      packageType: 'system',
      onPayload: vi.fn(),
      onError,
    });
    // macOS throws from `watch`; Linux emits `error` on the next tick. Give
    // the asynchronous path a moment before asserting, so this means the same
    // thing on both.
    await settle(60);
    expect(onError).toHaveBeenCalled();
    expect(() => watcher.close()).not.toThrow();
  });
});
