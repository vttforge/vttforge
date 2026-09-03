import { mkdtempSync, rmSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runManifestRules } from '../../audit/manifest-rules.js';

describe('runManifestRules', () => {
  let cwd: string;

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), 'vttforge-audit-manifest-'));
  });

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });

  it('returns no findings when no manifest is present', async () => {
    expect(await runManifestRules(cwd)).toEqual([]);
  });

  it('tolerates an unparseable manifest without crashing', async () => {
    await writeFile(join(cwd, 'system.json'), 'not json at all', 'utf8');
    expect(await runManifestRules(cwd)).toEqual([]);
  });

  it('tolerates a manifest that is a JSON array (Foundry would also reject it)', async () => {
    await writeFile(join(cwd, 'system.json'), '[]', 'utf8');
    expect(await runManifestRules(cwd)).toEqual([]);
  });

  describe('VTTF-AUDIT-001 — flags.hotReload shape', () => {
    it('flags array-shaped flags.hotReload as HIGH', async () => {
      await writeFile(
        join(cwd, 'system.json'),
        JSON.stringify({
          id: 'my-system',
          version: '1.0.0',
          flags: { hotReload: ['css', 'hbs'] },
        }),
        'utf8',
      );
      const results = await runManifestRules(cwd);
      expect(results).toHaveLength(1);
      expect(results[0]?.ruleId).toBe('VTTF-AUDIT-001');
      expect(results[0]?.severity).toBe('HIGH');
      expect(results[0]?.line).toBeGreaterThan(0);
    });

    it('flags non-object scalar shapes (e.g. boolean) as HIGH', async () => {
      await writeFile(
        join(cwd, 'module.json'),
        JSON.stringify({ id: 'my-module', version: '1.0.0', flags: { hotReload: true } }),
        'utf8',
      );
      const results = await runManifestRules(cwd);
      expect(results).toHaveLength(1);
      expect(results[0]?.ruleId).toBe('VTTF-AUDIT-001');
    });

    it('flags `flags.hotReload: null` as HIGH (typeof null === "object")', async () => {
      await writeFile(
        join(cwd, 'system.json'),
        JSON.stringify({ id: 'my-system', version: '1.0.0', flags: { hotReload: null } }),
        'utf8',
      );
      const results = await runManifestRules(cwd);
      expect(results).toHaveLength(1);
      expect(results[0]?.ruleId).toBe('VTTF-AUDIT-001');
    });

    it('flags an object missing the required `extensions` key as HIGH', async () => {
      await writeFile(
        join(cwd, 'system.json'),
        JSON.stringify({
          id: 'my-system',
          version: '1.0.0',
          flags: { hotReload: { paths: ['styles'] } }, // missing `extensions`
        }),
        'utf8',
      );
      const results = await runManifestRules(cwd);
      expect(results).toHaveLength(1);
      expect(results[0]?.ruleId).toBe('VTTF-AUDIT-001');
      expect(results[0]?.title).toContain('extensions');
    });

    it('accepts `extensions` without `paths` (Foundry defaults to package root)', async () => {
      await writeFile(
        join(cwd, 'system.json'),
        JSON.stringify({
          id: 'my-system',
          version: '1.0.0',
          flags: { hotReload: { extensions: ['css', 'hbs'] } },
        }),
        'utf8',
      );
      expect(await runManifestRules(cwd)).toEqual([]);
    });

    it('passes the v13 object shape', async () => {
      await writeFile(
        join(cwd, 'system.json'),
        JSON.stringify({
          id: 'my-system',
          version: '1.0.0',
          flags: {
            hotReload: {
              extensions: ['css', 'hbs', 'json'],
              paths: ['styles', 'templates', 'lang'],
            },
          },
        }),
        'utf8',
      );
      expect(await runManifestRules(cwd)).toEqual([]);
    });

    it('passes when flags is absent entirely', async () => {
      await writeFile(
        join(cwd, 'system.json'),
        JSON.stringify({ id: 'my-system', version: '1.0.0' }),
        'utf8',
      );
      expect(await runManifestRules(cwd)).toEqual([]);
    });

    it('flags both manifest files independently when both are misconfigured', async () => {
      const broken = { id: 'x', version: '1.0.0', flags: { hotReload: ['css'] } };
      await writeFile(join(cwd, 'system.json'), JSON.stringify(broken), 'utf8');
      await writeFile(join(cwd, 'module.json'), JSON.stringify(broken), 'utf8');
      const results = await runManifestRules(cwd);
      expect(results.filter((r) => r.ruleId === 'VTTF-AUDIT-001')).toHaveLength(2);
    });
  });

  describe('VTTF-AUDIT-002 — grid shape', () => {
    it('flags top-level gridDistance as MEDIUM', async () => {
      await writeFile(
        join(cwd, 'system.json'),
        JSON.stringify({ id: 'my-system', version: '1.0.0', gridDistance: 5 }),
        'utf8',
      );
      const results = await runManifestRules(cwd);
      expect(results).toHaveLength(1);
      expect(results[0]?.ruleId).toBe('VTTF-AUDIT-002');
      expect(results[0]?.severity).toBe('MEDIUM');
    });

    it('flags top-level gridUnits as MEDIUM', async () => {
      await writeFile(
        join(cwd, 'system.json'),
        JSON.stringify({ id: 'my-system', version: '1.0.0', gridUnits: 'ft' }),
        'utf8',
      );
      const results = await runManifestRules(cwd);
      expect(results.some((r) => r.ruleId === 'VTTF-AUDIT-002')).toBe(true);
    });

    it('does not double-flag when both legacy keys are present', async () => {
      await writeFile(
        join(cwd, 'system.json'),
        JSON.stringify({
          id: 'my-system',
          version: '1.0.0',
          gridDistance: 5,
          gridUnits: 'ft',
        }),
        'utf8',
      );
      const results = await runManifestRules(cwd);
      expect(results.filter((r) => r.ruleId === 'VTTF-AUDIT-002')).toHaveLength(1);
    });

    it('passes the v13 grid object', async () => {
      await writeFile(
        join(cwd, 'system.json'),
        JSON.stringify({
          id: 'my-system',
          version: '1.0.0',
          grid: { type: 1, distance: 5, units: 'ft', diagonals: 0 },
        }),
        'utf8',
      );
      expect(await runManifestRules(cwd)).toEqual([]);
    });
  });

  describe('VTTF-AUDIT-003 — styles shape', () => {
    it('flags styles array of strings as LOW', async () => {
      await writeFile(
        join(cwd, 'system.json'),
        JSON.stringify({
          id: 'my-system',
          version: '1.0.0',
          styles: ['styles/foo.css'],
        }),
        'utf8',
      );
      const results = await runManifestRules(cwd);
      expect(results).toHaveLength(1);
      expect(results[0]?.ruleId).toBe('VTTF-AUDIT-003');
      expect(results[0]?.severity).toBe('LOW');
    });

    it('flags a mixed array as long as any entry is a string', async () => {
      await writeFile(
        join(cwd, 'system.json'),
        JSON.stringify({
          id: 'my-system',
          version: '1.0.0',
          styles: [{ src: 'styles/a.css' }, 'styles/b.css'],
        }),
        'utf8',
      );
      const results = await runManifestRules(cwd);
      expect(results.some((r) => r.ruleId === 'VTTF-AUDIT-003')).toBe(true);
    });

    it('passes the v13 object-array shape', async () => {
      await writeFile(
        join(cwd, 'system.json'),
        JSON.stringify({
          id: 'my-system',
          version: '1.0.0',
          styles: [{ src: 'styles/a.css' }, { src: 'styles/b.css', layer: 'tokens' }],
        }),
        'utf8',
      );
      expect(await runManifestRules(cwd)).toEqual([]);
    });

    it('passes an empty styles array', async () => {
      await writeFile(
        join(cwd, 'system.json'),
        JSON.stringify({ id: 'my-system', version: '1.0.0', styles: [] }),
        'utf8',
      );
      expect(await runManifestRules(cwd)).toEqual([]);
    });

    it('passes when styles is absent', async () => {
      await writeFile(
        join(cwd, 'system.json'),
        JSON.stringify({ id: 'my-system', version: '1.0.0' }),
        'utf8',
      );
      expect(await runManifestRules(cwd)).toEqual([]);
    });
  });

  describe('multi-rule aggregation', () => {
    it('emits all three rules in a worst-case manifest', async () => {
      await writeFile(
        join(cwd, 'system.json'),
        JSON.stringify({
          id: 'my-system',
          version: '1.0.0',
          gridDistance: 5,
          gridUnits: 'ft',
          styles: ['styles/a.css'],
          flags: { hotReload: ['css'] },
        }),
        'utf8',
      );
      const results = await runManifestRules(cwd);
      const ids = results.map((r) => r.ruleId).sort();
      expect(ids).toEqual(['VTTF-AUDIT-001', 'VTTF-AUDIT-002', 'VTTF-AUDIT-003']);
    });

    it('emits zero findings on a clean v13 manifest', async () => {
      await writeFile(
        join(cwd, 'system.json'),
        JSON.stringify({
          id: 'my-system',
          version: '1.0.0',
          grid: { type: 1, distance: 5, units: 'ft', diagonals: 0 },
          styles: [{ src: 'styles/a.css' }],
          flags: { hotReload: { extensions: ['css'], paths: ['styles'] } },
        }),
        'utf8',
      );
      expect(await runManifestRules(cwd)).toEqual([]);
    });
  });
});

describe('VTTF-AUDIT-009 — a declared subtype with no name', () => {
  /** A module with one subtype, and whatever language file the test wants. */
  async function project(languages: Record<string, unknown> | null): Promise<string> {
    const dir = mkdtempSync(join(tmpdir(), 'vttforge-audit-types-'));
    await writeFile(
      join(dir, 'module.json'),
      JSON.stringify({
        id: 'my-module',
        version: '1.0.0',
        documentTypes: { Item: { note: { htmlFields: ['body'] } } },
        languages: [{ lang: 'en', name: 'English', path: 'lang/en.json' }],
      }),
      'utf8',
    );
    if (languages !== null) {
      await mkdir(join(dir, 'lang'), { recursive: true });
      await writeFile(join(dir, 'lang', 'en.json'), JSON.stringify(languages), 'utf8');
    }
    return dir;
  }

  it('flags a subtype no language file names', async () => {
    const dir = await project({ MY_MODULE: { Hello: 'Hi' } });
    const found = (await runManifestRules(dir)).filter((r) => r.ruleId === 'VTTF-AUDIT-009');
    expect(found).toHaveLength(1);
    expect(found[0]?.severity).toBe('MEDIUM');
    // The key carries the module id, which is the part people get wrong.
    expect(found[0]?.message).toContain('TYPES.Item.my-module.note');
    expect(found[0]?.remediation).toContain('"my-module"');
    rmSync(dir, { recursive: true, force: true });
  });

  it('accepts the nested form', async () => {
    const dir = await project({ TYPES: { Item: { 'my-module': { note: 'Note' } } } });
    expect((await runManifestRules(dir)).filter((r) => r.ruleId === 'VTTF-AUDIT-009')).toEqual([]);
    rmSync(dir, { recursive: true, force: true });
  });

  it('accepts the flattened form, which Foundry also reads', async () => {
    const dir = await project({ 'TYPES.Item.my-module.note': 'Note' });
    expect((await runManifestRules(dir)).filter((r) => r.ruleId === 'VTTF-AUDIT-009')).toEqual([]);
    rmSync(dir, { recursive: true, force: true });
  });

  it('accepts a half-flattened form', async () => {
    const dir = await project({ TYPES: { 'Item.my-module.note': 'Note' } });
    expect((await runManifestRules(dir)).filter((r) => r.ruleId === 'VTTF-AUDIT-009')).toEqual([]);
    rmSync(dir, { recursive: true, force: true });
  });

  it('says nothing when there is no language file to check against', async () => {
    // A package with no strings at all is a different finding to make.
    const dir = await project(null);
    expect((await runManifestRules(dir)).filter((r) => r.ruleId === 'VTTF-AUDIT-009')).toEqual([]);
    rmSync(dir, { recursive: true, force: true });
  });

  it('expects a system subtype without the id in the key', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'vttforge-audit-types-'));
    await writeFile(
      join(dir, 'system.json'),
      JSON.stringify({
        id: 'my-system',
        version: '1.0.0',
        documentTypes: { Actor: { character: {} } },
        languages: [{ lang: 'en', name: 'English', path: 'lang/en.json' }],
      }),
      'utf8',
    );
    await mkdir(join(dir, 'lang'), { recursive: true });
    // A system owns its type names; no module id in the path.
    await writeFile(
      join(dir, 'lang', 'en.json'),
      JSON.stringify({ TYPES: { Actor: { character: 'Character' } } }),
      'utf8',
    );
    expect((await runManifestRules(dir)).filter((r) => r.ruleId === 'VTTF-AUDIT-009')).toEqual([]);
    rmSync(dir, { recursive: true, force: true });
  });
});
