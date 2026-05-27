import { describe, expect, it } from 'vitest';
import {
  detectPackageManager,
  scaffold,
  substitute,
  templatesRoot,
  VTTFORGE_CLI_VERSION,
} from '../index.js';

describe('@vttforge/cli public surface', () => {
  it('exports the substitute helper', () => {
    expect(typeof substitute).toBe('function');
  });

  it('exports the scaffold function', () => {
    expect(typeof scaffold).toBe('function');
  });

  it('exports the templatesRoot resolver', () => {
    expect(typeof templatesRoot).toBe('function');
    expect(templatesRoot()).toContain('templates');
  });

  it('exports the package-manager helpers', () => {
    expect(typeof detectPackageManager).toBe('function');
  });

  it('exports the version constant', () => {
    expect(VTTFORGE_CLI_VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });
});
