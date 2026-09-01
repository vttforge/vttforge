/**
 * The CLI and the dev module agree on a port by convention, in two packages
 * that ship separately. Drift there fails the worst way available: the module
 * dials a port nobody holds, the retry loop swallows it, and the developer
 * sees a dev server that simply never reloads anything.
 */
import { DEFAULT_PORT } from '@vttforge/dev-module';
import { describe, expect, it } from 'vitest';
import { DEFAULT_HMR_PORT } from '../commands/dev.js';

describe('hot reload contract', () => {
  it('has both sides dialling the same port', () => {
    expect(DEFAULT_HMR_PORT).toBe(DEFAULT_PORT);
  });
});
