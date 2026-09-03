/**
 * VTTF-AUDIT-008, the sheet template that opens a form the sheet already is.
 *
 * The bug this exists for shipped in a real module and cost a release: the
 * sheet accepted every edit and dropped it on close, with nothing in the
 * console. The rule reads the Handlebars, because that is where it lives.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runTemplateRules } from '../../audit/template-rules.js';

let cwd: string;

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), 'vttforge-audit-template-'));
});

afterEach(() => {
  rmSync(cwd, { recursive: true, force: true });
});

/** Write a sheet class and the template its `PARTS` names. */
async function project(options: {
  base: string;
  template: string;
  served?: string;
  file?: string;
}): Promise<void> {
  const served = options.served ?? 'modules/my-module/templates/item/sheet.hbs';
  const file = options.file ?? 'templates/item/sheet.hbs';
  await mkdir(join(cwd, 'scripts'), { recursive: true });
  await writeFile(
    join(cwd, 'scripts', 'sheet.ts'),
    `import { ${options.base} } from '@vttforge/core';
export class MySheet extends ${options.base}() {
  static PARTS = { sheet: { template: '${served}' } };
}`,
    'utf8',
  );
  await mkdir(join(cwd, file.split('/').slice(0, -1).join('/')), { recursive: true });
  await writeFile(join(cwd, file), options.template, 'utf8');
}

describe('VTTF-AUDIT-008', () => {
  it('flags a form inside an item sheet template', async () => {
    await project({
      base: 'BaseItemSheet',
      template: '<form>\n  <input name="system.code" />\n</form>',
    });
    const found = await runTemplateRules(cwd);
    expect(found).toHaveLength(1);
    expect(found[0]?.ruleId).toBe('VTTF-AUDIT-008');
    expect(found[0]?.severity).toBe('HIGH');
    expect(found[0]?.filePath).toBe('templates/item/sheet.hbs');
    expect(found[0]?.line).toBe(1);
  });

  it('flags one inside an actor sheet template too', async () => {
    await project({
      base: 'BaseActorSheet',
      served: 'systems/my-system/templates/actor/sheet.hbs',
      file: 'templates/actor/sheet.hbs',
      template: '<div>\n</div>\n<form class="wrapper"></form>',
    });
    const found = await runTemplateRules(cwd);
    expect(found).toHaveLength(1);
    expect(found[0]?.line).toBe(3);
  });

  it('leaves a template alone when it opens no form', async () => {
    await project({
      base: 'BaseItemSheet',
      template: '<div>\n  <input name="system.code" />\n</div>',
    });
    expect(await runTemplateRules(cwd)).toEqual([]);
  });

  it('does not read a Handlebars comment as markup', async () => {
    // The fix for this bug leaves a comment saying why there is no form.
    // A rule that flagged its own remediation would be worse than useless.
    await project({
      base: 'BaseItemSheet',
      template: '{{!--\n  No <form> here: the application already is one.\n--}}\n<div></div>',
    });
    expect(await runTemplateRules(cwd)).toEqual([]);
  });

  it('leaves a plain application alone, which is not a form', async () => {
    // BaseApplication and BaseDocumentSheet do not set `tag: "form"`, so a
    // template of theirs may open one quite correctly.
    await project({ base: 'BaseApplication', template: '<form><input name="q" /></form>' });
    expect(await runTemplateRules(cwd)).toEqual([]);
  });

  it('says nothing about a template no sheet names', async () => {
    await mkdir(join(cwd, 'templates'), { recursive: true });
    await writeFile(join(cwd, 'templates', 'orphan.hbs'), '<form></form>', 'utf8');
    expect(await runTemplateRules(cwd)).toEqual([]);
  });

  it('survives a PARTS entry pointing at a file that is not there', async () => {
    await mkdir(join(cwd, 'scripts'), { recursive: true });
    await writeFile(
      join(cwd, 'scripts', 'sheet.ts'),
      `export class MySheet extends BaseItemSheet() {
  static PARTS = { sheet: { template: 'modules/my-module/templates/gone.hbs' } };
}`,
      'utf8',
    );
    expect(await runTemplateRules(cwd)).toEqual([]);
  });
});
