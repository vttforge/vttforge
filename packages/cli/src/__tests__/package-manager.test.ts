import { describe, expect, it } from 'vitest';
import { detectPackageManager, installCommand } from '../package-manager.js';

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
