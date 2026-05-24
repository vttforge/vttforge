import { describe, expect, it } from 'vitest';
import {
  docsUrlFor,
  getErrorEntry,
  listErrorEntries,
  VttfError,
  type VttfErrorCode,
} from '../errors/registry.js';

describe('error registry', () => {
  it('exposes every registered entry via listErrorEntries()', () => {
    const entries = listErrorEntries();
    expect(entries.length).toBeGreaterThanOrEqual(3);
    expect(entries.every((e) => e.code.startsWith('VTTF-'))).toBe(true);
    expect(entries.every((e) => /^[A-Z][A-Za-z0-9]+$/.test(e.name))).toBe(true);
  });

  it('returns the same entry by code', () => {
    const entry = getErrorEntry('VTTF-0001');
    expect(entry.name).toBe('SystemAlreadyRegistered');
    expect(entry.code).toBe('VTTF-0001');
  });

  it('throws on unknown code so typos surface immediately', () => {
    expect(() => getErrorEntry('VTTF-9999' as VttfErrorCode)).toThrow(
      /Unknown VTTForge error code/,
    );
  });

  it('docsUrlFor() produces stable docs URLs', () => {
    expect(docsUrlFor('VTTF-0001')).toBe('https://vttforge.dev/errors/VTTF-0001');
  });
});

describe('VttfError', () => {
  it('formats message as [CODE] summary by default', () => {
    const err = new VttfError('VTTF-0001');
    expect(err.message).toContain('[VTTF-0001]');
    expect(err.code).toBe('VTTF-0001');
    expect(err.name).toBe('SystemAlreadyRegistered');
    expect(err.docsUrl).toBe('https://vttforge.dev/errors/VTTF-0001');
  });

  it('uses a custom message when provided', () => {
    const err = new VttfError('VTTF-0001', 'system "ordemparanormal" registered twice');
    expect(err.message).toContain('[VTTF-0001]');
    expect(err.message).toContain('ordemparanormal');
  });

  it('preserves native cause (ES2022)', () => {
    const root = new Error('underlying failure');
    const err = new VttfError('VTTF-0002', 'wrapping', { cause: root });
    expect(err.cause).toBe(root);
  });

  it('supports AggregateError as cause for multi-cause failures', () => {
    const causes = [new Error('a'), new Error('b')];
    const agg = new AggregateError(causes, 'combined');
    const err = new VttfError('VTTF-0002', 'wrap multi', { cause: agg });
    expect(err.cause).toBe(agg);
    expect((err.cause as AggregateError).errors).toHaveLength(2);
  });

  it('throws on unknown code', () => {
    expect(() => new VttfError('VTTF-9999' as VttfErrorCode)).toThrow(/Unknown VTTForge/);
  });

  it('is an Error subclass (instanceof works across realms)', () => {
    const err = new VttfError('VTTF-0001');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(VttfError);
  });
});
