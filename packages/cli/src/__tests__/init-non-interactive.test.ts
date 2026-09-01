/**
 * `vttforge init` without a terminal.
 *
 * Clack prompts read from stdin. With none attached they never resolve, so
 * before this the scaffolder simply hung — no error, no output, nothing to
 * debug. That ruled out CI, scripts, and testing the scaffolder through its
 * own entry point.
 *
 * These cases drive `runInit` with `stdin.isTTY` off, which is what any
 * non-interactive caller looks like.
 */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runInit, ScaffoldError } from '../commands/init.js';

let cwd: string;
let originalIsTTY: boolean | undefined;

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), 'vttforge-init-'));
  originalIsTTY = process.stdin.isTTY;
  Object.defineProperty(process.stdin, 'isTTY', { value: false, configurable: true });
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  Object.defineProperty(process.stdin, 'isTTY', { value: originalIsTTY, configurable: true });
  vi.restoreAllMocks();
  rmSync(cwd, { recursive: true, force: true });
});

const readJson = (...parts: string[]) => JSON.parse(readFileSync(join(...parts), 'utf8'));

describe('runInit without a terminal', () => {
  it('scaffolds from the defaults alone', async () => {
    await runInit({ cwd, name: 'smoke-module', type: 'module', noInstall: true, noGit: true });

    const manifest = readJson(cwd, 'smoke-module', 'module.json');
    expect(manifest.id).toBe('smoke-module');
    expect(manifest.title).toBe('Smoke Module');
    expect(manifest.compatibility.minimum).toBe('13');
  });

  it('takes every metadata value from its option', async () => {
    await runInit({
      cwd,
      name: 'sheet-module',
      type: 'module',
      lang: 'ts',
      id: 'pdf-character-sheet',
      title: 'PDF Character Sheet',
      description: 'Form-fillable PDFs as character sheets',
      author: 'Fabricio Cavalcante',
      license: 'Apache-2.0',
      noInstall: true,
      noGit: true,
    });

    const manifest = readJson(cwd, 'sheet-module', 'module.json');
    expect(manifest).toMatchObject({
      id: 'pdf-character-sheet',
      title: 'PDF Character Sheet',
      description: 'Form-fillable PDFs as character sheets',
      authors: [{ name: 'Fabricio Cavalcante' }],
    });
    expect(readJson(cwd, 'sheet-module', 'package.json').license).toBe('Apache-2.0');
  });

  it('defaults type to system and lang to TypeScript', async () => {
    await runInit({ cwd, name: 'bare', noInstall: true, noGit: true });
    expect(readJson(cwd, 'bare', 'system.json').id).toBe('bare');
  });

  it('refuses a bad id from the flag instead of scaffolding one', async () => {
    // The prompt validates; a flag has to be held to the same rule, or an
    // invalid id lands in the manifest and Foundry rejects the package.
    await expect(
      runInit({ cwd, name: 'ok-name', id: 'Not A Valid Id', noInstall: true, noGit: true }),
    ).rejects.toThrow(ScaffoldError);
  });

  it('says what is missing when it cannot ask for the name', async () => {
    await expect(runInit({ cwd, noInstall: true, noGit: true })).rejects.toThrow(ScaffoldError);
  });

  it('honours --yes even with a terminal attached', async () => {
    Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true });
    await runInit({ cwd, name: 'forced', type: 'module', yes: true, noInstall: true, noGit: true });
    expect(readJson(cwd, 'forced', 'module.json').id).toBe('forced');
  });
});
