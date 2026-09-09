/**
 * Rule 007 resolves the token attributes against template.json when the
 * system still declares its types there: a v13 system on template.json has
 * no TypeDataModel to read, and its bars still work.
 */
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runSourceRules } from '../../audit/source-rules.js';

let cwd: string;

beforeEach(async () => {
  cwd = await mkdtemp(join(tmpdir(), 'vttf-007-'));
  await writeFile(
    join(cwd, 'system.json'),
    JSON.stringify({
      id: 's',
      version: '1.0.0',
      primaryTokenAttribute: 'abilities.STR',
      secondaryTokenAttribute: 'hp',
    }),
    'utf8',
  );
});

afterEach(async () => {
  await rm(cwd, { recursive: true, force: true });
});

const template = (actor: Record<string, unknown>) =>
  writeFile(join(cwd, 'template.json'), JSON.stringify({ Actor: actor }), 'utf8');
const findings007 = async () =>
  (await runSourceRules(cwd)).filter((f) => f.ruleId === 'VTTF-AUDIT-007');

describe('VTTF-AUDIT-007 with template.json', () => {
  it('resolves a path through the templates a type lists', async () => {
    await template({
      types: ['character'],
      templates: { base: { hp: { value: 6, max: 6 }, abilities: { STR: { value: 10, max: 10 } } } },
      character: { templates: ['base'], gold: 0 },
    });
    expect(await findings007()).toEqual([]);
  });

  it('still flags a path that no type declares with value and max', async () => {
    await template({ types: ['character'], character: { hp: 6, abilities: { STR: 10 } } });
    expect((await findings007()).map((f) => f.title)).toEqual([
      'primaryTokenAttribute does not resolve to a {value, max} SchemaField',
      'secondaryTokenAttribute does not resolve to a {value, max} SchemaField',
    ]);
  });
});
