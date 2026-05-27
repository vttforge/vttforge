import { mkdtempSync, rmSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolveViteEntry, ViteNotInstalledError } from '../vite-runner.js';

describe('resolveViteEntry', () => {
  let cwd: string;

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), 'vttforge-vite-'));
  });

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });

  it('returns the absolute path when vite is installed', async () => {
    const entry = join(cwd, 'node_modules', 'vite', 'bin', 'vite.js');
    await mkdir(join(cwd, 'node_modules', 'vite', 'bin'), { recursive: true });
    await writeFile(entry, '// fake', 'utf8');
    expect(resolveViteEntry(cwd)).toBe(entry);
  });

  it('throws ViteNotInstalledError when vite is missing', () => {
    expect(() => resolveViteEntry(cwd)).toThrow(ViteNotInstalledError);
  });

  it('surfaces an actionable message in the error', () => {
    try {
      resolveViteEntry(cwd);
      expect.fail('expected resolveViteEntry to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ViteNotInstalledError);
      expect((err as Error).message).toContain('pnpm install');
      expect((err as Error).message).toContain('node_modules/vite/bin/vite.js');
    }
  });
});
