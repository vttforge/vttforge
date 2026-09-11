/**
 * VTTF-AUDIT-022: a package that talks over its own socket channel while the
 * manifest never declares one. Foundry drops the emit and logs nothing.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runSourceRules } from '../audit/source-rules.js';

let cwd: string;

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), 'vttf-socket-'));
});

afterEach(() => {
  rmSync(cwd, { recursive: true, force: true });
});

async function project(manifest: Record<string, unknown>, source: string): Promise<void> {
  await writeFile(join(cwd, 'module.json'), JSON.stringify({ id: 'my-module', ...manifest }));
  await mkdir(join(cwd, 'scripts'), { recursive: true });
  await writeFile(join(cwd, 'scripts', 'main.mjs'), source);
}

async function findings(): Promise<ReturnType<typeof runSourceRules>> {
  const all = await runSourceRules(cwd);
  return all.filter((f) => f.ruleId === 'VTTF-AUDIT-022') as never;
}

describe('VTTF-AUDIT-022', () => {
  it('flags a raw emit on the package channel', async () => {
    await project(
      {},
      `const CHANNEL = 'module.my-module';
game.socket.on(CHANNEL, (data) => console.log(data));
game.socket.emit(CHANNEL, { hello: true });`,
    );

    const found = await findings();
    expect(found).toHaveLength(1);
    expect(found[0]?.severity).toBe('HIGH');
    expect(found[0]?.message).toContain('"socket": true');
    // The call without its open paren, and the manifest by name.
    expect(found[0]?.message).toContain('`game.socket.on`');
    expect(found[0]?.message).toContain('module.json');
    expect(found[0]?.line).toBe(2);
  });

  it('flags registerSocket on its own, with no channel string in sight', async () => {
    await project({}, `import { registerSocket } from '@vttforge/core';\nregisterSocket({});`);
    expect(await findings()).toHaveLength(1);
  });

  it('says nothing once the manifest declares the socket', async () => {
    await project(
      { socket: true },
      `game.socket.emit('module.my-module', { hello: true });\nregisterSocket({});`,
    );
    expect(await findings()).toEqual([]);
  });

  it('leaves a core socket event alone', async () => {
    // Core events travel the same socket under their own names. They work
    // without the manifest flag, and flagging them would train people to
    // ignore the rule.
    await project({}, `game.socket.on('userActivity', (id, activity) => track(id, activity));`);
    expect(await findings()).toEqual([]);
  });

  it('leaves a call quoted in a comment alone', async () => {
    await project(
      {},
      `/**
 * How to use this module from a macro:
 *   game.socket.emit('module.my-module', { hello: true });
 */
export function nothing() {}`,
    );
    expect(await findings()).toEqual([]);
  });

  it('reports once per file, not once per call', async () => {
    await project(
      {},
      `const C = 'module.my-module';
game.socket.emit(C, { a: 1 });
game.socket.emit(C, { b: 2 });
game.socket.emit(C, { c: 3 });`,
    );
    expect(await findings()).toHaveLength(1);
  });
});
