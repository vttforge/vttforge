/**
 * template.json → data models: the shape a v13 system still declares there,
 * turned into classes a reviewer can read.
 */
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runMigrateCommand } from '../../commands/migrate.js';
import { planDataModels } from '../../migrate/data-models.js';

const TEMPLATE = {
  Actor: {
    types: ['character', 'npc'],
    htmlFields: ['biography'],
    templates: {
      actorBase: { hp: { value: 6, max: 6 }, abilities: { STR: { value: 10, max: 10 } } },
    },
    character: {
      templates: ['base', 'actorBase'],
      biography: '',
      deprived: false,
      gold: 0,
      containers: [],
      features: [],
    },
    npc: { templates: ['base', 'actorBase', 'missing'], description: '', armor: 0.5 },
  },
  Item: {
    types: ['weapon'],
    templates: { withDamage: { damageFormula: '', blast: false } },
    weapon: { templates: ['base', 'withDamage'], quantity: 1, cost: null },
  },
};

describe('planDataModels', () => {
  it('writes a fragment per template and a class per type that spreads them', () => {
    const plan = planDataModels(TEMPLATE);
    expect(plan.files.map((f) => f.path)).toEqual([
      'scripts/data/actor/templates.mjs',
      'scripts/data/actor/character-data.mjs',
      'scripts/data/actor/npc-data.mjs',
      'scripts/data/item/templates.mjs',
      'scripts/data/item/weapon-data.mjs',
    ]);
    const character = plan.files[1]?.source ?? '';
    expect(character).toContain("import { actorBaseFields } from './templates.mjs';");
    expect(character).toContain(
      'export class CharacterData extends foundry.abstract.TypeDataModel {',
    );
    expect(character).toContain('...actorBaseFields(f),');
    expect(character).toContain(
      'biography: new f.HTMLField({ required: true, blank: true, initial: "" }),',
    );
    expect(character).toContain(
      'deprived: new f.BooleanField({ required: true, nullable: false, initial: false }),',
    );
    expect(character).toContain(
      'gold: new f.NumberField({ required: true, nullable: false, integer: true, initial: 0 }),',
    );
    expect(character).toContain('containers: new f.ArrayField(new f.ObjectField()),');
    const fragments = plan.files[0]?.source ?? '';
    expect(fragments).toContain('export function actorBaseFields(f) {');
    expect(fragments).toContain('hp: new f.SchemaField({');
    expect(fragments).toContain(
      'value: new f.NumberField({ required: true, nullable: false, integer: true, initial: 6 }),',
    );
    const npc = plan.files[2]?.source ?? '';
    expect(npc).toContain(
      'armor: new f.NumberField({ required: true, nullable: false, initial: 0.5 }),',
    );
  });

  it('carries htmlFields into documentTypes and writes the registration', () => {
    const plan = planDataModels(TEMPLATE);
    expect(plan.documentTypes).toEqual({
      Actor: { character: { htmlFields: ['biography'] }, npc: {} },
      Item: { weapon: {} },
    });
    expect(plan.registration).toContain(
      'Object.assign(CONFIG.Actor.dataModels, { character: CharacterData, npc: NpcData })',
    );
  });

  it('notes what it guessed: empty arrays, null values, a missing template, and the file to delete', () => {
    const { notes } = planDataModels(TEMPLATE);
    expect(notes.some((n) => n.startsWith('Actor.character.containers: an empty array'))).toBe(
      true,
    );
    expect(notes.some((n) => n.startsWith('Item.weapon.cost: null'))).toBe(true);
    expect(notes.some((n) => n.includes('lists template "missing"'))).toBe(true);
    expect(notes.at(-1)).toContain('delete template.json');
  });

  it('emits SDK classes on request, in TypeScript on request', () => {
    const plan = planDataModels(TEMPLATE, { style: 'sdk', lang: 'ts' });
    const weapon =
      plan.files.find((f) => f.path === 'scripts/data/item/weapon-data.ts')?.source ?? '';
    expect(weapon).toContain("import { BaseTypeDataModel, fields } from '@vttforge/core';");
    expect(weapon).toContain("import { withDamageFields } from './templates.js';");
    expect(weapon).toContain(
      'export class WeaponData extends BaseTypeDataModel(defineWeaponDataSchema) {',
    );
    expect(weapon).toContain('const f = fields();');
    expect(plan.registration).toContain(
      'registerSystem({ itemDataModels: { weapon: WeaponData } })',
    );
  });
});

describe('vttforge migrate --data-models', () => {
  let cwd: string;
  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), 'vttf-dm-'));
    await writeFile(
      join(cwd, 'system.json'),
      '{"id":"s","type":"system","compatibility":{"minimum":"14","verified":"14"}}',
      'utf8',
    );
    await writeFile(join(cwd, 'template.json'), JSON.stringify(TEMPLATE), 'utf8');
  });
  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  it('lists the files in preview and writes them with --write, never over an existing one', async () => {
    let out = '';
    const preview = await runMigrateCommand({
      cwd,
      dataModels: true,
      out: (c) => {
        out += c;
      },
    });
    expect(preview.report.dataModels?.files).toHaveLength(5);
    expect(out).toContain('Would write 5 data model file(s)');
    await expect(
      readFile(join(cwd, 'scripts/data/actor/character-data.mjs'), 'utf8'),
    ).rejects.toThrow();

    await writeFile(join(cwd, 'scripts'), '', 'utf8').catch(() => {});
    await rm(join(cwd, 'scripts'), { force: true });
    const written = await runMigrateCommand({ cwd, dataModels: true, write: true, out: () => {} });
    expect(written.report.dataModels?.files).toHaveLength(5);
    expect(await readFile(join(cwd, 'scripts/data/actor/character-data.mjs'), 'utf8')).toContain(
      'class CharacterData',
    );

    const again = await runMigrateCommand({ cwd, dataModels: true, write: true, out: () => {} });
    expect(again.report.dataModels?.files).toEqual([]);
    expect(again.report.dataModels?.notes[0]).toContain('exists and was left alone');
  });
});
