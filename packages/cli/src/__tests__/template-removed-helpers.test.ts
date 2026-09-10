/**
 * VTTF-AUDIT-021: a template that calls a helper v14 removed never renders.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runTemplateRules } from '../audit/template-rules.js';

describe('VTTF-AUDIT-021', () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = mkdtempSync(join(tmpdir(), 'vttforge-helpers-'));
    await mkdir(join(cwd, 'templates', 'dialog'), { recursive: true });
  });

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });

  it('flags {{#select}} and {{colorPicker}} with their lines', async () => {
    await writeFile(
      join(cwd, 'templates', 'dialog', 'menu.hbs'),
      '<div>\n  <select name="x">\n    {{#select value}}\n      <option value="a">A</option>\n    {{/select}}\n  </select>\n  {{colorPicker name="c" value=color}}\n</div>\n',
      'utf8',
    );
    const findings = (await runTemplateRules(cwd)).filter((f) => f.ruleId === 'VTTF-AUDIT-021');
    expect(findings.map((f) => [f.filePath, f.line, f.severity])).toEqual([
      ['templates/dialog/menu.hbs', 3, 'HIGH'],
      ['templates/dialog/menu.hbs', 7, 'HIGH'],
    ]);
    expect(findings[0]?.remediation).toMatch(/selectOptions/);
  });

  it('matches the block-less {{select}} form and keeps line numbers past a multi-line comment', async () => {
    await writeFile(
      join(cwd, 'templates', 'x.hbs'),
      '{{!-- a\n   b\n   c --}}\n<select>{{select value}}</select>\n',
      'utf8',
    );
    const f = (await runTemplateRules(cwd)).filter((f) => f.ruleId === 'VTTF-AUDIT-021');
    expect(f.map((x) => [x.filePath, x.line])).toEqual([['templates/x.hbs', 4]]);
  });

  it('reads templates outside templates/ too', async () => {
    await mkdir(join(cwd, 'src', 'ui'), { recursive: true });
    await writeFile(join(cwd, 'src', 'ui', 'picker.html'), '{{colorPicker name="c"}}\n', 'utf8');
    const findings = (await runTemplateRules(cwd)).filter((f) => f.ruleId === 'VTTF-AUDIT-021');
    expect(findings.map((f) => f.filePath)).toEqual(['src/ui/picker.html']);
  });

  it('ignores a helper named only in a Handlebars comment, and the new forms', async () => {
    await writeFile(
      join(cwd, 'templates', 'ok.hbs'),
      '{{!-- {{#select}} used to be here --}}\n<select name="x">{{selectOptions choices selected=value}}</select>\n<color-picker name="c"></color-picker>\n',
      'utf8',
    );
    expect((await runTemplateRules(cwd)).filter((f) => f.ruleId === 'VTTF-AUDIT-021')).toEqual([]);
  });
});
