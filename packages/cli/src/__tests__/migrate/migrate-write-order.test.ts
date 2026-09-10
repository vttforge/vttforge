/**
 * `--write` computes every rewrite before the first write, so a run that
 * throws on one file leaves the tree as it was.
 */
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const calls: string[] = [];
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    readFile: (async (...args: Parameters<typeof actual.readFile>) => {
      calls.push('read');
      return actual.readFile(...args);
    }) as typeof actual.readFile,
    writeFile: (async (...args: Parameters<typeof actual.writeFile>) => {
      calls.push('write');
      return actual.writeFile(...args);
    }) as typeof actual.writeFile,
  };
});

const { runMigrate } = await import('../../migrate/index.js');

let cwd: string;
beforeEach(async () => {
  cwd = await mkdtemp(join(tmpdir(), 'vttf-migrate-order-'));
  await writeFile(
    join(cwd, 'system.json'),
    '{ "id": "s", "compatibility": { "minimum": "13" } }\n',
    'utf8',
  );
  await writeFile(join(cwd, 'a.mjs'), 'mergeObject(a, b);\n', 'utf8');
  await writeFile(join(cwd, 'b.mjs'), 'Math.clamped(x, 0, 1);\n', 'utf8');
  await writeFile(
    join(cwd, 'sheet.mjs'),
    'export class S extends ActorSheet { activateListeners(html) { html.find(".a").click(() => 1); } }\n',
    'utf8',
  );
  calls.length = 0;
});
afterEach(async () => {
  await rm(cwd, { recursive: true, force: true });
});

describe('migrate --write', () => {
  it('reads and rewrites every file before it writes the first one', async () => {
    const report = await runMigrate({ cwd, write: true, sheets: true });
    expect(report.counts.changes).toBeGreaterThan(0);
    expect(report.sheets?.files).toHaveLength(1);
    const firstWrite = calls.indexOf('write');
    const lastRead = calls.lastIndexOf('read');
    expect(firstWrite).toBeGreaterThan(-1);
    expect(lastRead).toBeLessThan(firstWrite);
  });
});
