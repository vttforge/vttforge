import { describe, expect, it } from 'vitest';

describe('@vttforge/core smoke', () => {
  it('module loads', async () => {
    const mod = await import('../index.js');
    expect(mod).toBeDefined();
  });
});
