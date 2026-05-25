import { describe, expect, it } from 'vitest';
import { ERROR_MANIFEST_VERSION, getErrorManifest } from '../errors/manifest.js';
import { listErrorEntries } from '../errors/registry.js';

describe('getErrorManifest()', () => {
  it('returns the current envelope version', () => {
    const m = getErrorManifest();
    expect(m.version).toBe(ERROR_MANIFEST_VERSION);
    expect(m.version).toBe(1);
  });

  it('identifies the source package', () => {
    expect(getErrorManifest().package).toBe('@vttforge/core');
  });

  it('mirrors listErrorEntries() 1:1', () => {
    const manifestEntries = [...getErrorManifest().entries];
    const registryEntries = [...listErrorEntries()];
    expect(manifestEntries).toEqual(registryEntries);
  });

  it('includes every code currently in the registry (sanity check on append-only)', () => {
    const codes = getErrorManifest().entries.map((e) => e.code);
    for (const expected of ['VTTF-0001', 'VTTF-0002', 'VTTF-0003', 'VTTF-0004', 'VTTF-0005']) {
      expect(codes).toContain(expected);
    }
  });

  it('returns a fresh array each call (callers can sort/mutate without affecting later calls)', () => {
    const a = getErrorManifest().entries;
    const b = getErrorManifest().entries;
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
  });
});
