/**
 * VTTF-AUDIT-011 to 016: the v13 code that v14 broke or deprecated.
 */
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runAudit } from '../../audit/index.js';

let cwd: string;

beforeEach(async () => {
  cwd = await mkdtemp(join(tmpdir(), 'vttf-v14-'));
});

afterEach(async () => {
  await rm(cwd, { recursive: true, force: true });
});

async function auditSource(source: string) {
  await writeFile(join(cwd, 'main.mjs'), source, 'utf8');
  const report = await runAudit({ cwd });
  return report.findings.filter((f) => /VTTF-AUDIT-01[1-6]/.test(f.ruleId));
}

describe('VTTF-AUDIT-011: a global v14 removed', () => {
  it('flags a bare mergeObject call as HIGH', async () => {
    const findings = await auditSource('const merged = mergeObject(a, b);\n');
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ ruleId: 'VTTF-AUDIT-011', severity: 'HIGH', line: 1 });
    expect(findings[0]?.remediation).toContain('foundry.utils.mergeObject');
  });

  it('passes the namespaced call', async () => {
    expect(await auditSource('foundry.utils.mergeObject(a, b);\n')).toEqual([]);
  });

  it('passes a name the file defines or imports itself', async () => {
    expect(
      await auditSource('function getProperty(o, k) { return o[k]; }\ngetProperty(x, "y");\n'),
    ).toEqual([]);
    expect(await auditSource("import { deepClone } from './clone.mjs';\ndeepClone(x);\n")).toEqual(
      [],
    );
  });

  it('passes a method of the same name, which is how a test mocks foundry.utils', async () => {
    expect(
      await auditSource(
        'globalThis.foundry = { utils: { mergeObject(a, b) { return { ...a, ...b }; } } };\n',
      ),
    ).toEqual([]);
  });

  it('still reports Math.clamped when the file wraps a utility of its own', async () => {
    const findings = await auditSource(
      'function mergeObject(a, b) { return foundry.utils.mergeObject(a, b); }\nMath.clamped(x, 0, 10);\n',
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ line: 2 });
    expect(findings[0]?.remediation).toContain('Math.clamp');
  });

  it('recognises a definition whose parameters carry brackets', async () => {
    expect(
      await auditSource('function mergeObject(a, defaults = {}) { return a; }\nmergeObject(x);\n'),
    ).toEqual([]);
  });

  it('flags Math.clamped and game.template', async () => {
    const clamped = await auditSource('const v = Math.clamped(x, 0, 1);\n');
    expect(clamped[0]?.remediation).toContain('Math.clamp');
    const template = await auditSource('const types = game.template.Actor;\n');
    expect(template[0]?.remediation).toContain('game.model');
  });
});

describe('VTTF-AUDIT-012: -= / == update keys', () => {
  it('flags a deletion key', async () => {
    const findings = await auditSource(
      "await actor.update({\n  'system.biography': legacy,\n  '-=system.bio': null,\n});\n",
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ ruleId: 'VTTF-AUDIT-012', severity: 'MEDIUM', line: 3 });
  });

  it('flags a nested deletion and a replacement key', async () => {
    expect(await auditSource('await a.update({ "system.-=bio": null });\n')).toHaveLength(1);
    expect(await auditSource('await a.update({ "==system.stats": {} });\n')).toHaveLength(1);
  });

  it('passes the data operators', async () => {
    expect(
      await auditSource(
        "await actor.update({ 'system.bio': _del, 'system.stats': _replace({}) });\n",
      ),
    ).toEqual([]);
  });
});

describe('VTTF-AUDIT-013: rollMode', () => {
  it('flags the toMessage option and the core setting', async () => {
    expect(await auditSource("await roll.toMessage({}, { rollMode: 'gmroll' });\n")).toHaveLength(
      1,
    );
    expect(await auditSource('game.settings.get("core", "rollMode");\n')).toHaveLength(1);
    expect(await auditSource('for (const m in CONFIG.Dice.rollModes) {}\n')).toHaveLength(1);
  });

  it('passes messageMode', async () => {
    expect(
      await auditSource(
        "await roll.toMessage({}, { messageMode: game.settings.get('core', 'messageMode') });\n",
      ),
    ).toEqual([]);
  });
});

describe('VTTF-AUDIT-014: CONFIG.statusEffects assigned wholesale', () => {
  it('flags the assignment and passes add-by-id', async () => {
    expect(await auditSource('CONFIG.statusEffects = [{ id: "prone" }];\n')).toHaveLength(1);
    expect(await auditSource('CONFIG.statusEffects.prone = { id: "prone" };\n')).toEqual([]);
    expect(await auditSource('if (CONFIG.statusEffects === undefined) {}\n')).toEqual([]);
  });
});

describe('VTTF-AUDIT-015: legacyTransferral', () => {
  it('flags the flag', async () => {
    const findings = await auditSource('CONFIG.ActiveEffect.legacyTransferral = false;\n');
    expect(findings).toHaveLength(1);
    expect(findings[0]?.ruleId).toBe('VTTF-AUDIT-015');
  });
});

describe('VTTF-AUDIT-016: numeric Active Effect modes', () => {
  it('flags CONST.ACTIVE_EFFECT_MODES and passes string types', async () => {
    expect(
      await auditSource(
        'changes: [{ key: "system.ac", mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: 2 }]\n',
      ),
    ).toHaveLength(1);
    expect(
      await auditSource('system: { changes: [{ key: "system.ac", type: "add", value: 2 }] }\n'),
    ).toEqual([]);
  });
});

describe('a clean v14 file', () => {
  it('emits no v14 findings', async () => {
    expect(
      await auditSource(
        [
          "import { registerSystem } from '@vttforge/core';",
          'registerSystem({ id: "x", statusEffects: [{ id: "x.dazed", name: "Dazed" }] });',
          'await actor.update({ "system.old": _del });',
          'await roll.toMessage({}, { messageMode: "gm" });',
        ].join('\n'),
      ),
    ).toEqual([]);
  });
});
