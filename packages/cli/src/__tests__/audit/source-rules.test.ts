import { mkdtempSync, rmSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { _internal, runSourceRules } from '../../audit/source-rules.js';

describe('runSourceRules', () => {
  let cwd: string;

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), 'vttforge-audit-source-'));
  });

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });

  it('returns no findings on an empty project', async () => {
    expect(await runSourceRules(cwd)).toEqual([]);
  });

  it('skips excluded directories (node_modules, dist, …)', async () => {
    await mkdir(join(cwd, 'node_modules', 'something'), { recursive: true });
    await writeFile(
      join(cwd, 'node_modules', 'something', 'index.ts'),
      'class X extends TypeDataModel { static defineSchema() { return {}; } }',
      'utf8',
    );
    expect(await runSourceRules(cwd)).toEqual([]);
  });

  describe('VTTF-AUDIT-005 — prepareBaseData missing', () => {
    it('flags `extends TypeDataModel` without prepareBaseData', async () => {
      await writeFile(
        join(cwd, 'data.ts'),
        `class CharacterData extends foundry.abstract.TypeDataModel {
  static defineSchema() { return {}; }
  prepareDerivedData() {}
}`,
        'utf8',
      );
      const results = await runSourceRules(cwd);
      expect(results).toHaveLength(1);
      expect(results[0]?.ruleId).toBe('VTTF-AUDIT-005');
      expect(results[0]?.severity).toBe('MEDIUM');
      expect(results[0]?.line).toBe(1);
    });

    it('does not flag when prepareBaseData is defined', async () => {
      await writeFile(
        join(cwd, 'data.ts'),
        `class CharacterData extends foundry.abstract.TypeDataModel {
  prepareBaseData() {}
}`,
        'utf8',
      );
      expect(await runSourceRules(cwd)).toEqual([]);
    });

    it('does not flag the `BaseTypeDataModel()` factory pattern', async () => {
      // VTTForge's factory returns a class that already provides the stub.
      // `\bTypeDataModel\b` does not match inside `BaseTypeDataModel`.
      await writeFile(
        join(cwd, 'data.ts'),
        `import { BaseTypeDataModel } from '@vttforge/core';
class CharacterData extends BaseTypeDataModel() {
  static defineSchema() { return {}; }
}`,
        'utf8',
      );
      expect(await runSourceRules(cwd)).toEqual([]);
    });

    it('reports one finding per offending class (not one per file)', async () => {
      // Codex round-2 fix: a file with two TypeDataModel subclasses where
      // only one defines prepareBaseData must still flag the sibling.
      await writeFile(
        join(cwd, 'data.ts'),
        `class AData extends TypeDataModel {
  prepareBaseData() {}
}
class BData extends TypeDataModel {
  static defineSchema() { return {}; }
}`,
        'utf8',
      );
      const five = (await runSourceRules(cwd)).filter((r) => r.ruleId === 'VTTF-AUDIT-005');
      // AData has the hook; BData is missing it — only BData flags.
      expect(five).toHaveLength(1);
      expect(five[0]?.message).toContain('BData');
    });

    it('flags every class when multiple are missing the hook', async () => {
      await writeFile(
        join(cwd, 'data.ts'),
        `class AData extends TypeDataModel {}
class BData extends TypeDataModel {}`,
        'utf8',
      );
      const five = (await runSourceRules(cwd)).filter((r) => r.ruleId === 'VTTF-AUDIT-005');
      expect(five).toHaveLength(2);
      expect(five.map((f) => f.message).join(' ')).toContain('AData');
      expect(five.map((f) => f.message).join(' ')).toContain('BData');
    });
  });

  describe('VTTF-AUDIT-006 — _addDataFieldMigrations override', () => {
    it('flags an override on a TypeDataModel subclass', async () => {
      await writeFile(
        join(cwd, 'data.ts'),
        `class CharacterData extends foundry.abstract.TypeDataModel {
  prepareBaseData() {}
  _addDataFieldMigrations() { return []; }
}`,
        'utf8',
      );
      const results = await runSourceRules(cwd);
      expect(results.some((r) => r.ruleId === 'VTTF-AUDIT-006')).toBe(true);
    });

    it('does not flag files that have _addDataFieldMigrations but no TypeDataModel', async () => {
      // E.g. a documentation example or a helper script.
      await writeFile(
        join(cwd, 'helper.ts'),
        `function showSignature() { return '_addDataFieldMigrations(source, oldKey, newKey)'; }`,
        'utf8',
      );
      expect(await runSourceRules(cwd)).toEqual([]);
    });

    it('also flags overrides on the BaseTypeDataModel() factory pattern', async () => {
      // Most templates use BaseTypeDataModel(). A bad migration override
      // there should still be caught.
      await writeFile(
        join(cwd, 'data.ts'),
        `class CharacterData extends BaseTypeDataModel() {
  _addDataFieldMigrations() {}
}`,
        'utf8',
      );
      const six = (await runSourceRules(cwd)).filter((r) => r.ruleId === 'VTTF-AUDIT-006');
      expect(six).toHaveLength(1);
    });
  });

  describe('VTTF-AUDIT-004 — HTMLField / FilePathField not declared', () => {
    it('attributes a factory schema to its class for the per-subtype check', async () => {
      // `biography` is declared for `Actor.character` but the factory
      // schema is registered under `Actor.npc` too. Without factory
      // ownership the rule would fall back to the global union and pass.
      await writeFile(
        join(cwd, 'system.json'),
        JSON.stringify({
          id: 'my-system',
          version: '1.0.0',
          documentTypes: { Actor: { character: { htmlFields: ['biography'] }, npc: {} } },
        }),
        'utf8',
      );
      await writeFile(
        join(cwd, 'data.ts'),
        `const defineSchema = () => ({ biography: new fields.HTMLField() });
class PersonData extends BaseTypeDataModel(defineSchema) {}
registerSystem({ id: 'my-system', actorDataModels: { character: PersonData, npc: PersonData } });`,
        'utf8',
      );
      const four = (await runSourceRules(cwd)).filter((r) => r.ruleId === 'VTTF-AUDIT-004');
      expect(four).toHaveLength(1);
      expect(four[0]?.message).toContain('Actor.npc');
    });

    it('flags HTMLField that is missing from manifest documentTypes', async () => {
      await writeFile(
        join(cwd, 'system.json'),
        JSON.stringify({
          id: 'my-system',
          version: '1.0.0',
          documentTypes: { Actor: { character: { htmlFields: [] } } },
        }),
        'utf8',
      );
      await writeFile(
        join(cwd, 'data.ts'),
        `static defineSchema() {
  return {
    biography: new f.HTMLField(),
  };
}`,
        'utf8',
      );
      const results = await runSourceRules(cwd);
      const four = results.filter((r) => r.ruleId === 'VTTF-AUDIT-004');
      expect(four).toHaveLength(1);
      expect(four[0]?.message).toContain('biography');
    });

    it('passes when the field is declared in manifest', async () => {
      await writeFile(
        join(cwd, 'system.json'),
        JSON.stringify({
          id: 'my-system',
          version: '1.0.0',
          documentTypes: { Actor: { character: { htmlFields: ['biography'] } } },
        }),
        'utf8',
      );
      await writeFile(
        join(cwd, 'data.ts'),
        `static defineSchema() { return { biography: new f.HTMLField() }; }`,
        'utf8',
      );
      const results = await runSourceRules(cwd);
      expect(results.filter((r) => r.ruleId === 'VTTF-AUDIT-004')).toHaveLength(0);
    });

    it('accepts dot-paths in the manifest (uses last segment)', async () => {
      await writeFile(
        join(cwd, 'system.json'),
        JSON.stringify({
          id: 'my-system',
          version: '1.0.0',
          documentTypes: { Actor: { character: { htmlFields: ['system.biography'] } } },
        }),
        'utf8',
      );
      await writeFile(
        join(cwd, 'data.ts'),
        `static defineSchema() { return { biography: new f.HTMLField() }; }`,
        'utf8',
      );
      expect(await runSourceRules(cwd)).toEqual([]);
    });

    it('flags an undeclared field when class IS registered to a subtype', async () => {
      // Even though Actor.character declares biography, our class is
      // registered to Actor.npc which doesn't — the strict per-subtype
      // check catches it where the global-union fallback would miss.
      await writeFile(
        join(cwd, 'system.json'),
        JSON.stringify({
          id: 'my-system',
          version: '1.0.0',
          documentTypes: {
            Actor: {
              character: { htmlFields: ['biography'] },
              npc: { htmlFields: [] },
            },
          },
        }),
        'utf8',
      );
      await writeFile(join(cwd, 'main.ts'), `CONFIG.Actor.dataModels.npc = NpcData;`, 'utf8');
      await writeFile(
        join(cwd, 'npc-data.ts'),
        `class NpcData extends BaseTypeDataModel() {
  static defineSchema() { return { biography: new f.HTMLField() }; }
}`,
        'utf8',
      );
      const four = (await runSourceRules(cwd)).filter((r) => r.ruleId === 'VTTF-AUDIT-004');
      expect(four).toHaveLength(1);
      expect(four[0]?.message).toContain('Actor.npc');
    });

    it('passes when the class IS registered AND the matching subtype declares the field', async () => {
      await writeFile(
        join(cwd, 'system.json'),
        JSON.stringify({
          id: 'my-system',
          version: '1.0.0',
          documentTypes: { Actor: { npc: { htmlFields: ['biography'] } } },
        }),
        'utf8',
      );
      await writeFile(join(cwd, 'main.ts'), `CONFIG.Actor.dataModels.npc = NpcData;`, 'utf8');
      await writeFile(
        join(cwd, 'npc-data.ts'),
        `class NpcData extends BaseTypeDataModel() {
  static defineSchema() { return { biography: new f.HTMLField() }; }
}`,
        'utf8',
      );
      const four = (await runSourceRules(cwd)).filter((r) => r.ruleId === 'VTTF-AUDIT-004');
      expect(four).toHaveLength(0);
    });

    it('does not let a declared `profile.bio` shadow an undeclared `journal.bio`', async () => {
      // Codex round-2 fix: leaf-only matching would accept the global
      // `bio` declaration. Now we compare FULL source paths against
      // declared full paths.
      await writeFile(
        join(cwd, 'system.json'),
        JSON.stringify({
          id: 'my-system',
          version: '1.0.0',
          documentTypes: { Actor: { character: { htmlFields: ['profile.bio'] } } },
        }),
        'utf8',
      );
      await writeFile(
        join(cwd, 'data.ts'),
        `static defineSchema() {
  return {
    journal: new fields.SchemaField({
      bio: new fields.HTMLField(),
    }),
  };
}`,
        'utf8',
      );
      const four = (await runSourceRules(cwd)).filter((r) => r.ruleId === 'VTTF-AUDIT-004');
      expect(four).toHaveLength(1);
      expect(four[0]?.message).toContain('journal.bio');
    });

    it('accepts a nested HTMLField when its full path matches the manifest', async () => {
      await writeFile(
        join(cwd, 'system.json'),
        JSON.stringify({
          id: 'my-system',
          version: '1.0.0',
          documentTypes: { Actor: { character: { htmlFields: ['profile.bio'] } } },
        }),
        'utf8',
      );
      await writeFile(
        join(cwd, 'data.ts'),
        `static defineSchema() {
  return {
    profile: new fields.SchemaField({
      bio: new fields.HTMLField(),
    }),
  };
}`,
        'utf8',
      );
      const four = (await runSourceRules(cwd)).filter((r) => r.ruleId === 'VTTF-AUDIT-004');
      expect(four).toHaveLength(0);
    });

    it('detects registerSystem(...) DataModel registrations', async () => {
      // VTTForge templates register through `registerSystem({ actorDataModels })`.
      // Without recognising that form, rule 004 would fall back to the
      // global-union check and miss subtype-specific gaps.
      await writeFile(
        join(cwd, 'system.json'),
        JSON.stringify({
          id: 'my-system',
          version: '1.0.0',
          documentTypes: {
            Actor: {
              character: { htmlFields: ['biography'] },
              npc: { htmlFields: [] },
            },
          },
        }),
        'utf8',
      );
      await writeFile(
        join(cwd, 'main.ts'),
        `registerSystem({
  actorDataModels: { character: CharacterData, npc: NpcData },
});`,
        'utf8',
      );
      await writeFile(
        join(cwd, 'npc-data.ts'),
        `class NpcData extends BaseTypeDataModel() {
  static defineSchema() { return { biography: new f.HTMLField() }; }
}`,
        'utf8',
      );
      const four = (await runSourceRules(cwd)).filter((r) => r.ruleId === 'VTTF-AUDIT-004');
      expect(four).toHaveLength(1);
      expect(four[0]?.message).toContain('Actor.npc');
    });

    it('flags FilePathField independently from HTMLField', async () => {
      await writeFile(
        join(cwd, 'system.json'),
        JSON.stringify({
          id: 'my-system',
          version: '1.0.0',
          documentTypes: { Actor: { character: { htmlFields: ['biography'] } } },
        }),
        'utf8',
      );
      await writeFile(
        join(cwd, 'data.ts'),
        `static defineSchema() {
  return {
    biography: new f.HTMLField(),
    portrait: new f.FilePathField({ categories: ['IMAGE'] }),
  };
}`,
        'utf8',
      );
      const four = (await runSourceRules(cwd)).filter((r) => r.ruleId === 'VTTF-AUDIT-004');
      expect(four).toHaveLength(1);
      expect(four[0]?.message).toContain('portrait');
      expect(four[0]?.message).toContain('FilePathField');
    });
  });

  describe('VTTF-AUDIT-007 — token attribute SchemaField', () => {
    it('resolves a schema declared in a named factory handed to BaseTypeDataModel()', async () => {
      // The typed factory keeps the schema in a function outside the class.
      // With the class registered as an Actor model, the rule scopes to
      // Actor classes — and must still find the field through the factory.
      await writeFile(
        join(cwd, 'system.json'),
        JSON.stringify({ id: 'my-system', version: '1.0.0', primaryTokenAttribute: 'health' }),
        'utf8',
      );
      await writeFile(
        join(cwd, 'data.ts'),
        `const defineCharacterSchema = () => {
  const f = fields();
  return {
    health: new f.SchemaField({
      value: new f.NumberField(),
      max: new f.NumberField(),
    }),
  };
};
export class CharacterData extends BaseTypeDataModel(defineCharacterSchema) {}
registerSystem({ id: 'my-system', actorDataModels: { character: CharacterData } });`,
        'utf8',
      );
      expect(await runSourceRules(cwd)).toEqual([]);
    });

    it('still scopes a factory schema to the class that owns it', async () => {
      // The factory belongs to an Item model; token bars read actor.system.
      await writeFile(
        join(cwd, 'system.json'),
        JSON.stringify({ id: 'my-system', version: '1.0.0', primaryTokenAttribute: 'health' }),
        'utf8',
      );
      await writeFile(
        join(cwd, 'data.ts'),
        `function defineGearSchema() {
  return {
    health: new fields.SchemaField({ value: new fields.NumberField(), max: new fields.NumberField() }),
  };
}
class GearData extends BaseTypeDataModel(defineGearSchema) {}
class CharacterData extends BaseTypeDataModel(() => ({})) {}
registerSystem({ id: 'my-system', actorDataModels: { character: CharacterData }, itemDataModels: { gear: GearData } });`,
        'utf8',
      );
      const seven = (await runSourceRules(cwd)).filter((r) => r.ruleId === 'VTTF-AUDIT-007');
      expect(seven).toHaveLength(1);
    });

    it('passes when health resolves to {value, max} SchemaField', async () => {
      await writeFile(
        join(cwd, 'system.json'),
        JSON.stringify({
          id: 'my-system',
          version: '1.0.0',
          primaryTokenAttribute: 'health',
        }),
        'utf8',
      );
      await writeFile(
        join(cwd, 'data.ts'),
        `static defineSchema() {
  return {
    health: new fields.SchemaField({
      value: new fields.NumberField(),
      max: new fields.NumberField(),
    }),
  };
}`,
        'utf8',
      );
      expect(await runSourceRules(cwd)).toEqual([]);
    });

    it('does NOT accept a nested NumberField.max as the SchemaField.max key', async () => {
      // The naive `/\bmax\s*:/.test(body)` check would pass this — both
      // `value:` and `max:` appear in the captured body. The top-level-key
      // scanner rejects it because `max:` is at depth 1 (inside the
      // NumberField constructor), not at depth 0 of the SchemaField body.
      await writeFile(
        join(cwd, 'system.json'),
        JSON.stringify({
          id: 'my-system',
          version: '1.0.0',
          primaryTokenAttribute: 'health',
        }),
        'utf8',
      );
      await writeFile(
        join(cwd, 'data.ts'),
        `static defineSchema() {
  return {
    health: new fields.SchemaField({
      value: new fields.NumberField({ max: 100 }),
    }),
  };
}`,
        'utf8',
      );
      const seven = (await runSourceRules(cwd)).filter((r) => r.ruleId === 'VTTF-AUDIT-007');
      expect(seven).toHaveLength(1);
    });

    it('flags when manifest names an attribute that has no matching SchemaField', async () => {
      await writeFile(
        join(cwd, 'system.json'),
        JSON.stringify({
          id: 'my-system',
          version: '1.0.0',
          primaryTokenAttribute: 'sanity',
        }),
        'utf8',
      );
      await writeFile(
        join(cwd, 'data.ts'),
        `static defineSchema() {
  return { health: new fields.SchemaField({ value: new fields.NumberField(), max: new fields.NumberField() }) };
}`,
        'utf8',
      );
      const results = await runSourceRules(cwd);
      const seven = results.filter((r) => r.ruleId === 'VTTF-AUDIT-007');
      expect(seven).toHaveLength(1);
      expect(seven[0]?.message).toContain('sanity');
    });

    it('flags a SchemaField that is missing the max key', async () => {
      await writeFile(
        join(cwd, 'system.json'),
        JSON.stringify({
          id: 'my-system',
          version: '1.0.0',
          primaryTokenAttribute: 'health',
        }),
        'utf8',
      );
      await writeFile(
        join(cwd, 'data.ts'),
        `static defineSchema() {
  return { health: new fields.SchemaField({ value: new fields.NumberField() }) };
}`,
        'utf8',
      );
      const seven = (await runSourceRules(cwd)).filter((r) => r.ruleId === 'VTTF-AUDIT-007');
      expect(seven).toHaveLength(1);
    });

    it('resolves nested paths against the actual source schema (passing case)', async () => {
      // Codex round-3 fix: rule 007 used to emit a MEDIUM finding for
      // any dotted path with "verify manually". Now it walks the source
      // and validates against the declaration at the EXACT dot-path.
      await writeFile(
        join(cwd, 'system.json'),
        JSON.stringify({
          id: 'my-system',
          version: '1.0.0',
          primaryTokenAttribute: 'attributes.hp',
        }),
        'utf8',
      );
      await writeFile(
        join(cwd, 'data.ts'),
        `static defineSchema() {
  return {
    attributes: new fields.SchemaField({
      hp: new fields.SchemaField({
        value: new fields.NumberField(),
        max: new fields.NumberField(),
      }),
    }),
  };
}`,
        'utf8',
      );
      expect(await runSourceRules(cwd)).toEqual([]);
    });

    it('flags a top-level token attribute that only exists nested in source', async () => {
      // Codex round-3 fix: manifest says `health`, but the only matching
      // SchemaField is nested under `attributes`. Schema path
      // `attributes.health` ≠ manifest path `health` — fail.
      await writeFile(
        join(cwd, 'system.json'),
        JSON.stringify({
          id: 'my-system',
          version: '1.0.0',
          primaryTokenAttribute: 'health',
        }),
        'utf8',
      );
      await writeFile(
        join(cwd, 'data.ts'),
        `static defineSchema() {
  return {
    attributes: new fields.SchemaField({
      health: new fields.SchemaField({
        value: new fields.NumberField(),
        max: new fields.NumberField(),
      }),
    }),
  };
}`,
        'utf8',
      );
      const seven = (await runSourceRules(cwd)).filter((r) => r.ruleId === 'VTTF-AUDIT-007');
      expect(seven).toHaveLength(1);
    });

    it('checks secondaryTokenAttribute independently', async () => {
      await writeFile(
        join(cwd, 'system.json'),
        JSON.stringify({
          id: 'my-system',
          version: '1.0.0',
          primaryTokenAttribute: 'health',
          secondaryTokenAttribute: 'mana',
        }),
        'utf8',
      );
      await writeFile(
        join(cwd, 'data.ts'),
        `static defineSchema() {
  return { health: new fields.SchemaField({ value: new fields.NumberField(), max: new fields.NumberField() }) };
}`,
        'utf8',
      );
      const seven = (await runSourceRules(cwd)).filter((r) => r.ruleId === 'VTTF-AUDIT-007');
      expect(seven).toHaveLength(1);
      expect(seven[0]?.message).toContain('mana');
    });

    it('does nothing when no token attribute is declared', async () => {
      await writeFile(
        join(cwd, 'system.json'),
        JSON.stringify({ id: 'my-system', version: '1.0.0' }),
        'utf8',
      );
      expect(await runSourceRules(cwd)).toEqual([]);
    });
  });
});

describe('_internal.isSourceFile', () => {
  it('accepts every supported source extension', () => {
    expect(_internal.isSourceFile('main.ts')).toBe(true);
    expect(_internal.isSourceFile('main.tsx')).toBe(true);
    expect(_internal.isSourceFile('main.mts')).toBe(true);
    expect(_internal.isSourceFile('main.cts')).toBe(true);
    expect(_internal.isSourceFile('main.mjs')).toBe(true);
    expect(_internal.isSourceFile('main.cjs')).toBe(true);
    expect(_internal.isSourceFile('main.js')).toBe(true);
  });

  it('rejects declaration files', () => {
    expect(_internal.isSourceFile('types.d.ts')).toBe(false);
    expect(_internal.isSourceFile('types.d.mts')).toBe(false);
    expect(_internal.isSourceFile('types.d.cts')).toBe(false);
  });

  it('rejects non-source extensions', () => {
    expect(_internal.isSourceFile('README.md')).toBe(false);
    expect(_internal.isSourceFile('system.json')).toBe(false);
    expect(_internal.isSourceFile('main.css')).toBe(false);
  });
});

describe('_internal.lastSegment', () => {
  it('returns the final dot-separated segment', () => {
    expect(_internal.lastSegment('system.biography')).toBe('biography');
    expect(_internal.lastSegment('a.b.c.d')).toBe('d');
  });

  it('returns the whole string when there is no dot', () => {
    expect(_internal.lastSegment('biography')).toBe('biography');
  });
});

/**
 * The three soundness gaps that shipped documented rather than fixed.
 * Each case fails against the original implementation, so the fix has
 * evidence rather than a claim.
 */
describe('audit soundness gaps', () => {
  let cwd: string;

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), 'vttforge-audit-gaps-'));
  });

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });

  describe('filePathFields declared as an object', () => {
    it('honours the object shape, whose keys are the field paths', async () => {
      await writeFile(
        join(cwd, 'system.json'),
        JSON.stringify({
          id: 'my-system',
          version: '1.0.0',
          documentTypes: {
            Actor: {
              character: { filePathFields: { 'portrait.src': ['IMAGE'] } },
            },
          },
        }),
        'utf8',
      );
      await writeFile(
        join(cwd, 'data.ts'),
        `class CharacterData extends TypeDataModel {
  static defineSchema() {
    return { portrait: new fields.SchemaField({ src: new fields.FilePathField() }) };
  }
}
CONFIG.Actor.dataModels.character = CharacterData;`,
        'utf8',
      );
      const four = (await runSourceRules(cwd)).filter((r) => r.ruleId === 'VTTF-AUDIT-004');
      expect(four).toEqual([]);
    });

    it('still flags a path the object does not declare', async () => {
      await writeFile(
        join(cwd, 'system.json'),
        JSON.stringify({
          id: 'my-system',
          version: '1.0.0',
          documentTypes: {
            Actor: { character: { filePathFields: { 'portrait.src': ['IMAGE'] } } },
          },
        }),
        'utf8',
      );
      await writeFile(
        join(cwd, 'data.ts'),
        `class CharacterData extends TypeDataModel {
  static defineSchema() {
    return { banner: new fields.FilePathField() };
  }
}
CONFIG.Actor.dataModels.character = CharacterData;`,
        'utf8',
      );
      const four = (await runSourceRules(cwd)).filter((r) => r.ruleId === 'VTTF-AUDIT-004');
      expect(four).toHaveLength(1);
    });
  });

  describe('module-prefixed subtype keys', () => {
    it('matches a bare manifest key against the prefixed registration', async () => {
      await writeFile(
        join(cwd, 'module.json'),
        JSON.stringify({
          id: 'my-module',
          version: '1.0.0',
          documentTypes: { Actor: { vehicle: { htmlFields: ['notes'] } } },
        }),
        'utf8',
      );
      await writeFile(
        join(cwd, 'data.ts'),
        `class VehicleData extends TypeDataModel {
  static defineSchema() {
    return { notes: new fields.HTMLField() };
  }
}
CONFIG.Actor.dataModels['my-module.vehicle'] = VehicleData;`,
        'utf8',
      );
      const four = (await runSourceRules(cwd)).filter((r) => r.ruleId === 'VTTF-AUDIT-004');
      expect(four).toEqual([]);
    });

    it('does not strip a prefix belonging to a different package', async () => {
      await writeFile(
        join(cwd, 'module.json'),
        JSON.stringify({
          id: 'my-module',
          version: '1.0.0',
          documentTypes: { Actor: { vehicle: { htmlFields: ['notes'] } } },
        }),
        'utf8',
      );
      await writeFile(
        join(cwd, 'data.ts'),
        `class VehicleData extends TypeDataModel {
  static defineSchema() {
    return { notes: new fields.HTMLField() };
  }
}
CONFIG.Actor.dataModels['other-module.vehicle'] = VehicleData;`,
        'utf8',
      );
      const four = (await runSourceRules(cwd)).filter((r) => r.ruleId === 'VTTF-AUDIT-004');
      expect(four).toHaveLength(1);
    });
  });

  describe('rule 007 actor scoping', () => {
    it('does not accept an Item model as the token attribute source', async () => {
      await writeFile(
        join(cwd, 'system.json'),
        JSON.stringify({ id: 'my-system', version: '1.0.0', primaryTokenAttribute: 'health' }),
        'utf8',
      );
      await writeFile(
        join(cwd, 'data.ts'),
        `class CharacterData extends TypeDataModel {
  static defineSchema() {
    return { level: new fields.NumberField() };
  }
}
class PotionData extends TypeDataModel {
  static defineSchema() {
    return {
      health: new fields.SchemaField({
        value: new fields.NumberField(),
        max: new fields.NumberField(),
      }),
    };
  }
}
CONFIG.Actor.dataModels.character = CharacterData;
CONFIG.Item.dataModels.potion = PotionData;`,
        'utf8',
      );
      const seven = (await runSourceRules(cwd)).filter((r) => r.ruleId === 'VTTF-AUDIT-007');
      expect(seven).toHaveLength(1);
    });

    it('accepts the same schema once it is registered as an Actor model', async () => {
      await writeFile(
        join(cwd, 'system.json'),
        JSON.stringify({ id: 'my-system', version: '1.0.0', primaryTokenAttribute: 'health' }),
        'utf8',
      );
      await writeFile(
        join(cwd, 'data.ts'),
        `class CharacterData extends TypeDataModel {
  static defineSchema() {
    return {
      health: new fields.SchemaField({
        value: new fields.NumberField(),
        max: new fields.NumberField(),
      }),
    };
  }
}
CONFIG.Actor.dataModels.character = CharacterData;`,
        'utf8',
      );
      const seven = (await runSourceRules(cwd)).filter((r) => r.ruleId === 'VTTF-AUDIT-007');
      expect(seven).toEqual([]);
    });
  });
});
