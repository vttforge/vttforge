import { mkdtempSync, rmSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  detectPackageManager,
  detectProjectPackageManager,
  execInvocation,
  installCommand,
} from '../package-manager.js';

describe('detectPackageManager', () => {
  it('returns "pnpm" when the user agent starts with pnpm', () => {
    expect(
      detectPackageManager({ npm_config_user_agent: 'pnpm/8.0.0 node/v22.0.0 darwin arm64' }),
    ).toBe('pnpm');
  });

  it('returns "npm" when the user agent starts with npm', () => {
    expect(
      detectPackageManager({ npm_config_user_agent: 'npm/10.0.0 node/v22.0.0 darwin arm64' }),
    ).toBe('npm');
  });

  it('returns "bun" when the user agent starts with bun', () => {
    expect(
      detectPackageManager({ npm_config_user_agent: 'bun/1.1.0 node/v22.0.0 darwin arm64' }),
    ).toBe('bun');
  });

  it('returns "yarn" when the user agent starts with yarn', () => {
    expect(
      detectPackageManager({ npm_config_user_agent: 'yarn/4.0.0 npm/? node/v22.0.0 darwin arm64' }),
    ).toBe('yarn');
  });

  it('defaults to pnpm when no user agent is set', () => {
    expect(detectPackageManager({})).toBe('pnpm');
  });

  it('defaults to pnpm when the user agent is empty', () => {
    expect(detectPackageManager({ npm_config_user_agent: '' })).toBe('pnpm');
  });

  it('defaults to pnpm when the user agent is an unknown manager', () => {
    expect(detectPackageManager({ npm_config_user_agent: 'someTool/1.0.0' })).toBe('pnpm');
  });
});

describe('installCommand', () => {
  it('returns the install command for each manager', () => {
    expect(installCommand('pnpm')).toBe('pnpm install');
    expect(installCommand('npm')).toBe('npm install');
    expect(installCommand('bun')).toBe('bun install');
    expect(installCommand('yarn')).toBe('yarn install');
  });
});

describe('detectProjectPackageManager', () => {
  let cwd: string;

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), 'vttforge-pm-detect-'));
  });

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });

  it('returns pnpm when pnpm-lock.yaml is present', async () => {
    await writeFile(join(cwd, 'pnpm-lock.yaml'), '', 'utf8');
    expect(detectProjectPackageManager(cwd, {})).toBe('pnpm');
  });

  it('returns yarn when yarn.lock is present', async () => {
    await writeFile(join(cwd, 'yarn.lock'), '', 'utf8');
    expect(detectProjectPackageManager(cwd, {})).toBe('yarn');
  });

  it('returns bun when bun.lock is present', async () => {
    await writeFile(join(cwd, 'bun.lock'), '', 'utf8');
    expect(detectProjectPackageManager(cwd, {})).toBe('bun');
  });

  it('returns bun when the older bun.lockb is present', async () => {
    await writeFile(join(cwd, 'bun.lockb'), '', 'utf8');
    expect(detectProjectPackageManager(cwd, {})).toBe('bun');
  });

  it('returns npm when package-lock.json is present', async () => {
    await writeFile(join(cwd, 'package-lock.json'), '{}', 'utf8');
    expect(detectProjectPackageManager(cwd, {})).toBe('npm');
  });

  it('returns npm when npm-shrinkwrap.json is present (published-package convention)', async () => {
    await writeFile(join(cwd, 'npm-shrinkwrap.json'), '{}', 'utf8');
    expect(detectProjectPackageManager(cwd, {})).toBe('npm');
  });

  it('falls back to user-agent detection when no lockfile is present', () => {
    expect(detectProjectPackageManager(cwd, { npm_config_user_agent: 'yarn/4.0.0 npm/?' })).toBe(
      'yarn',
    );
  });

  it('defaults to pnpm when neither lockfile nor user agent is available', () => {
    expect(detectProjectPackageManager(cwd, {})).toBe('pnpm');
  });
});

describe('execInvocation', () => {
  it('uses pnpm exec for pnpm projects', () => {
    expect(execInvocation('pnpm', 'vite')).toEqual(['pnpm', ['exec', 'vite']]);
  });

  it('uses yarn exec -- for Yarn (PnP-safe)', () => {
    expect(execInvocation('yarn', 'vite')).toEqual(['yarn', ['exec', '--', 'vite']]);
  });

  it('uses bun x for bun projects', () => {
    expect(execInvocation('bun', 'vite')).toEqual(['bun', ['x', 'vite']]);
  });

  it('uses npx --no-install for npm projects', () => {
    expect(execInvocation('npm', 'vite')).toEqual(['npx', ['--no-install', 'vite']]);
  });
});
