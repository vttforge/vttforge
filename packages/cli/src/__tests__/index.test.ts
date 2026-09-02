import { describe, expect, it } from 'vitest';
import cliPackage from '../../package.json' with { type: 'json' };
import {
  detectPackageManager,
  detectProjectPackageManager,
  emitReleaseZip,
  emitZip,
  execInvocation,
  readManifest,
  resolveFoundryDataDir,
  resolveViteInvocation,
  runBuild,
  runDev,
  runInit,
  scaffold,
  setupDevSymlink,
  substitute,
  templatesRoot,
  VTTFORGE_CLI_VERSION,
} from '../index.js';

describe('@vttforge/cli public surface', () => {
  it('exports the scaffolder + substitution helpers', () => {
    expect(typeof substitute).toBe('function');
    expect(typeof scaffold).toBe('function');
    expect(typeof templatesRoot).toBe('function');
    expect(templatesRoot()).toContain('templates');
  });

  it('exports the command entry points', () => {
    expect(typeof runInit).toBe('function');
    expect(typeof runDev).toBe('function');
    expect(typeof runBuild).toBe('function');
  });

  it('exports the testable orchestration helpers', () => {
    expect(typeof setupDevSymlink).toBe('function');
    expect(typeof emitReleaseZip).toBe('function');
  });

  it('exports the foundry data + manifest + zip primitives', () => {
    expect(typeof resolveFoundryDataDir).toBe('function');
    expect(typeof readManifest).toBe('function');
    expect(typeof emitZip).toBe('function');
  });

  it('exports the package-manager helpers', () => {
    expect(typeof detectPackageManager).toBe('function');
    expect(typeof detectProjectPackageManager).toBe('function');
    expect(typeof execInvocation).toBe('function');
    expect(typeof resolveViteInvocation).toBe('function');
  });

  it('exports the version constant', () => {
    expect(VTTFORGE_CLI_VERSION).toBe(cliPackage.version);
  });
});
