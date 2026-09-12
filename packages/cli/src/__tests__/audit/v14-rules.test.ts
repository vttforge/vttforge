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
  return report.findings.filter((f) => /VTTF-AUDIT-01[1-9]/.test(f.ruleId));
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

  it('still flags a call inside an if-block (was a false negative before the [^)]* fix)', async () => {
    const findings = await auditSource(
      "if (hasProperty(actor, 'system.hp')) {\n  actor.update({ 'system.hp': 10 });\n}\n",
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ ruleId: 'VTTF-AUDIT-011', severity: 'HIGH' });
  });

  it('flags Math.clamped and game.template', async () => {
    const clamped = await auditSource('const v = Math.clamped(x, 0, 1);\n');
    expect(clamped[0]?.remediation).toContain('Math.clamp');
    const template = await auditSource('const types = game.template.Actor;\n');
    expect(template[0]?.remediation).toContain('game.model');
  });
});

describe('comments are not findings', () => {
  it('ignores a call quoted in a JSDoc block, a line comment, and a block comment', async () => {
    expect(
      await auditSource(
        [
          '/**',
          ' * `foundry.utils.flattenObject` looks like the tool and is not:',
          ' * ```js',
          ' * flattenObject({ system: actor.system })',
          ' * ```',
          ' */',
          '// TODO: drop mergeObject(a, b) here',
          '/* rollMode: "gmroll" was the old way; "-=key": null too */',
          'export const walk = (o) => o;',
        ].join('\n'),
      ),
    ).toEqual([]);
  });

  it('still reports the call after the comment, on its own line', async () => {
    const findings = await auditSource(
      '// mergeObject(a, b) is gone\nconst m = mergeObject(a, b);\n',
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ ruleId: 'VTTF-AUDIT-011', line: 2 });
  });

  it('does not mistake a URL in a string for a comment', async () => {
    const findings = await auditSource('const u = "https://x.test"; mergeObject(a, b);\n');
    expect(findings).toHaveLength(1);
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

describe('VTTF-AUDIT-017: renderChatMessage', () => {
  it('flags the jQuery hook and passes the HTML one', async () => {
    const findings = await auditSource(
      'Hooks.on("renderChatMessage", (m, html) => html.find("a"));\n',
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ ruleId: 'VTTF-AUDIT-017', severity: 'MEDIUM', line: 1 });
    expect(
      await auditSource(
        'Hooks.on("renderChatMessageHTML", (m, html) => html.querySelector("a"));\n',
      ),
    ).toEqual([]);
  });
});

describe('VTTF-AUDIT-018: Application v1 bases', () => {
  it('flags the v1 bases, bare or namespaced, and passes the V2 ones', async () => {
    const only018 = async (src: string) =>
      (await auditSource(src)).filter((f) => f.ruleId === 'VTTF-AUDIT-018');
    expect(await only018('class S extends ActorSheet {}\n')).toHaveLength(1);
    expect(await only018('class M extends foundry.appv1.api.FormApplication {}\n')).toHaveLength(1);
    expect((await only018('class D extends Dialog {}\n'))[0]?.severity).toBe('LOW');
    expect(
      await auditSource(
        'class S extends foundry.applications.sheets.ActorSheetV2 {}\nclass D extends DialogV2 {}\n',
      ),
    ).toEqual([]);
  });
});

describe('vendored libraries', () => {
  it('does not read a minified bundle', async () => {
    await writeFile(join(cwd, 'jszip.min.js'), 'a({"-=x":null});mergeObject(a,b);\n', 'utf8');
    expect(await auditSource('export const x = 1;\n')).toEqual([]);
  });
});

describe('VTTF-AUDIT-019: bare v13 global aliases', () => {
  it('flags a bare alias with its path, and passes the namespaced form', async () => {
    const findings = await auditSource('const html = await renderTemplate(path, data);\n');
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ ruleId: 'VTTF-AUDIT-019', severity: 'MEDIUM', line: 1 });
    expect(findings[0]?.message).toContain('foundry.applications.handlebars.renderTemplate');
    expect(
      await auditSource('await foundry.applications.handlebars.renderTemplate(p, d);\n'),
    ).toEqual([]);
  });

  it('ignores an object key, a property, a declared name, and a word in a string', async () => {
    expect(
      await auditSource(
        [
          'const bag = { Token: 1, Items: [] };',
          'const t = canvas.tokens.Token;',
          'class Token { move() {} }',
          'new Token();',
          'ui.notifications.info("Token moved");',
          '',
        ].join('\n'),
      ),
    ).toEqual([]);
  });

  it('flags a class extending a bare v1 sheet, once per file', async () => {
    const findings = await auditSource(
      'class A extends ActorSheet {}\nclass B extends ItemSheet {}\n',
    );
    expect(findings.filter((f) => f.ruleId === 'VTTF-AUDIT-019')).toHaveLength(1);
  });

  it('passes a TypeScript member signature, which declares the name', async () => {
    expect(
      await auditSource(
        [
          'interface FoundryHandlebars {',
          '  renderTemplate(path: string, context: unknown): Promise<string>;',
          '}',
          'declare const h: FoundryHandlebars;',
          '',
        ].join('\n'),
      ),
    ).toEqual([]);
    expect(
      await auditSource(
        [
          'type Utils = {',
          '  readonly saveDataToFile(data: string, type: string, name: string): void;',
          '};',
          '',
        ].join('\n'),
      ),
    ).toEqual([]);
    // Method whose parameter carries a function type with its own parens.
    expect(
      await auditSource(
        [
          'interface Helpers {',
          '  renderTemplate(callback: () => void): Promise<string>;',
          '}',
          '',
        ].join('\n'),
      ),
    ).toEqual([]);
  });

  it('still flags a call in a ternary, where the name does not open the line', async () => {
    const findings = await auditSource(
      ['const html = ready', '  ? renderTemplate(p, d)', '  : fallback;', ''].join('\n'),
    );
    expect(findings.filter((f) => f.ruleId === 'VTTF-AUDIT-019')).toHaveLength(1);
  });
});
