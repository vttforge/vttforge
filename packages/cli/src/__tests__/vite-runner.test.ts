import { mkdtempSync, rmSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveViteInvocation, ViteNotInstalledError } from '../vite-runner.js';

describe('resolveViteInvocation', () => {
  let cwd: string;

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), 'vttforge-vite-'));
  });

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });

  it('returns the pnpm exec invocation when pnpm-lock.yaml is present', async () => {
    await writeFile(join(cwd, 'package.json'), '{}', 'utf8');
    await writeFile(join(cwd, 'pnpm-lock.yaml'), '', 'utf8');
    expect(resolveViteInvocation(cwd)).toEqual(['pnpm', ['exec', 'vite']]);
  });

  it('returns the yarn exec invocation when yarn.lock is present', async () => {
    await writeFile(join(cwd, 'package.json'), '{}', 'utf8');
    await writeFile(join(cwd, 'yarn.lock'), '', 'utf8');
    expect(resolveViteInvocation(cwd)).toEqual(['yarn', ['exec', '--', 'vite']]);
  });

  it('returns the bun x invocation when bun.lock is present', async () => {
    await writeFile(join(cwd, 'package.json'), '{}', 'utf8');
    await writeFile(join(cwd, 'bun.lock'), '', 'utf8');
    expect(resolveViteInvocation(cwd)).toEqual(['bun', ['x', 'vite']]);
  });

  it('returns the npx invocation when package-lock.json is present', async () => {
    await writeFile(join(cwd, 'package.json'), '{}', 'utf8');
    await writeFile(join(cwd, 'package-lock.json'), '{}', 'utf8');
    expect(resolveViteInvocation(cwd)).toEqual(['npx', ['--no-install', 'vite']]);
  });

  describe('when no lockfile is present', () => {
    // No lockfile means `detectProjectPackageManager` defers to
    // `detectPackageManager`, which reads `npm_config_user_agent` from
    // `process.env` at call time. Stub that var directly so the assertion
    // is a concrete literal, not a re-derivation of the implementation's
    // own detection chain, and doesn't depend on which package manager
    // happens to be running the test suite itself (bun, pnpm, ...).
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('falls back to the launching package manager (bun) when npm_config_user_agent says so', async () => {
      await writeFile(join(cwd, 'package.json'), '{}', 'utf8');
      vi.stubEnv('npm_config_user_agent', 'bun/1.4.2 npm/? node/v26.3.0 darwin arm64');
      expect(resolveViteInvocation(cwd)).toEqual(['bun', ['x', 'vite']]);
    });

    it('defaults to pnpm when npm_config_user_agent is unset', async () => {
      await writeFile(join(cwd, 'package.json'), '{}', 'utf8');
      vi.stubEnv('npm_config_user_agent', undefined);
      expect(resolveViteInvocation(cwd)).toEqual(['pnpm', ['exec', 'vite']]);
    });
  });

  it('throws ViteNotInstalledError when package.json is missing', () => {
    expect(() => resolveViteInvocation(cwd)).toThrow(ViteNotInstalledError);
  });

  it('surfaces an actionable message when there is no package.json', () => {
    try {
      resolveViteInvocation(cwd);
      expect.fail('expected resolveViteInvocation to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ViteNotInstalledError);
      expect((err as Error).message).toContain('package.json');
      expect((err as Error).message).toContain('vttforge dev');
    }
  });
});
