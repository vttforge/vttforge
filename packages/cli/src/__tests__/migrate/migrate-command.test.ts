/**
 * The command over a real directory: preview by default, written on request.
 */
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runAudit } from '../../audit/index.js';
import { runMigrateCommand } from '../../commands/migrate.js';

let cwd: string;
const MANIFEST =
  '{\n  "id": "my-system",\n  "title": "T",\n  "compatibility": { "minimum": "13", "verified": "13" }\n}\n';
const SOURCE =
  "const merged = mergeObject(a, b);\nawait actor.update({ '-=system.bio': null });\nroll.toMessage({}, { rollMode: 'gmroll' });\n";

beforeEach(async () => {
  cwd = await mkdtemp(join(tmpdir(), 'vttf-migrate-'));
  await writeFile(join(cwd, 'system.json'), MANIFEST, 'utf8');
  await writeFile(join(cwd, 'main.mjs'), SOURCE, 'utf8');
});

afterEach(async () => {
  await rm(cwd, { recursive: true, force: true });
});

describe('vttforge migrate', () => {
  it('previews by default and writes nothing', async () => {
    let out = '';
    const { report, exitCode } = await runMigrateCommand({
      cwd,
      out: (c) => {
        out += c;
      },
    });
    expect(exitCode).toBe(0);
    expect(report.written).toBe(false);
    expect(report.counts).toEqual({ files: 2, changes: 6, notes: 0 });
    expect(out).toContain('Would rewrite 6 place(s) in 2 file(s)');
    expect(out).toContain('--write');
    expect(await readFile(join(cwd, 'main.mjs'), 'utf8')).toBe(SOURCE);
    expect(await readFile(join(cwd, 'system.json'), 'utf8')).toBe(MANIFEST);
  });

  it('writes with --write, and the audit is clean afterwards', async () => {
    let out = '';
    const { report } = await runMigrateCommand({
      cwd,
      write: true,
      out: (c) => {
        out += c;
      },
    });
    expect(report.written).toBe(true);
    expect(out).toContain('Rewrote 6 place(s)');
    expect(await readFile(join(cwd, 'main.mjs'), 'utf8')).toBe(
      "const merged = foundry.utils.mergeObject(a, b);\nawait actor.update({ 'system.bio': _del });\nroll.toMessage({}, { messageMode: 'gm' });\n",
    );
    expect(await readFile(join(cwd, 'system.json'), 'utf8')).toBe(
      '{\n  "id": "my-system",\n  "type": "system",\n  "title": "T",\n  "compatibility": { "minimum": "14", "verified": "14" }\n}\n',
    );

    const audit = await runAudit({ cwd });
    expect(audit.findings.filter((f) => /VTTF-AUDIT-01[1-6]/.test(f.ruleId))).toEqual([]);

    // A second run has nothing left to do.
    const again = await runMigrateCommand({ cwd, out: () => {} });
    expect(again.report.counts.changes).toBe(0);
  });

  it('emits JSON on request', async () => {
    let out = '';
    await runMigrateCommand({
      cwd,
      json: true,
      out: (c) => {
        out += c;
      },
    });
    const parsed = JSON.parse(out);
    expect(parsed.files.map((f: { file: string }) => f.file)).toEqual(['main.mjs', 'system.json']);
  });

  it('says so when the target is not a directory', async () => {
    await expect(runMigrateCommand({ cwd: join(cwd, 'nope'), out: () => {} })).rejects.toThrow(
      /not a directory/,
    );
  });
});

describe('vttforge migrate --sheets', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const FIXTURE = readFileSync(join(here, 'fixtures', 'v1-actor-sheet.mjs'), 'utf8');
  const TEMPLATE =
    '<form><nav class="tabs"><a data-tab="items">I</a></nav><div class="tab" data-tab="items"><a class="item-create">+</a></div></form>\n';

  async function sheetProject(): Promise<void> {
    await mkdir(join(cwd, 'module'), { recursive: true });
    await mkdir(join(cwd, 'templates'), { recursive: true });
    await writeFile(join(cwd, 'module', 'actor-sheet.mjs'), FIXTURE, 'utf8');
    await writeFile(join(cwd, 'templates', 'actor-sheet.html'), TEMPLATE, 'utf8');
  }

  it('previews a V2 file and the template edits, then writes them', async () => {
    await sheetProject();
    const preview = await runMigrateCommand({ cwd, sheets: true, json: true, out: () => {} });
    expect(preview.report.sheets?.files.map((f) => f.to)).toEqual(['module/actor-sheet.v2.mjs']);
    expect(preview.report.sheets?.files[0]?.actions.map((a) => a.name)).toContain('itemCreate');
    expect(preview.report.sheets?.templates[0]?.file).toBe('templates/actor-sheet.html');
    expect(preview.report.sheets?.templates[0]?.edits.length).toBeGreaterThan(0);
    expect(preview.report.sheets?.templates[0]?.formRoot).toBe(true);
    expect(existsSync(join(cwd, 'module', 'actor-sheet.v2.mjs'))).toBe(false);
    expect(await readFile(join(cwd, 'templates', 'actor-sheet.html'), 'utf8')).toBe(TEMPLATE);

    await runMigrateCommand({ cwd, sheets: true, write: true, out: () => {} });
    const generated = await readFile(join(cwd, 'module', 'actor-sheet.v2.mjs'), 'utf8');
    expect(generated).toContain('extends BaseActorSheet()');
    // The tab ids came from the template.
    expect(generated).toContain("tabs: [{ id: 'items' }]");
    const template = await readFile(join(cwd, 'templates', 'actor-sheet.html'), 'utf8');
    expect(template).toContain('data-action="itemCreate"');
    expect(template).toContain('data-action="vttforgeTab"');
    const original = await readFile(join(cwd, 'module', 'actor-sheet.mjs'), 'utf8');
    expect(original).toMatch(/extends (?:foundry\.appv1\.sheets\.)?ActorSheet \{/);
    expect(original).toContain('activateListeners(html)');

    const again = await runMigrateCommand({ cwd, sheets: true, write: true, out: () => {} });
    expect(again.report.sheets?.notes.some((n) => /exists and was left alone/.test(n))).toBe(true);
  });

  it('prints the sheet section in the text report', async () => {
    await sheetProject();
    let out = '';
    await runMigrateCommand({
      cwd,
      sheets: true,
      out: (c) => {
        out += c;
      },
    });
    expect(out).toMatch(/Would write 1 sheet file/);
    expect(out).toMatch(/module\/actor-sheet\.v2\.mjs: HeroSheet extends BaseActorSheet\(\)/);
    expect(out).toMatch(/action itemCreate/);
    expect(out).toMatch(/registerSheet/);
    expect(out).toMatch(/Would edit templates:\n {2}templates\/actor-sheet\.html/);
  });

  it('reads every template when the class builds its path at runtime', async () => {
    await sheetProject();
    const dynamic = FIXTURE.replace(
      "template: 'systems/hero/templates/actor-sheet.html',",
      '',
    ).replace(
      'static get defaultOptions() {',
      'get template() {\n    return `systems/hero/templates/${this.actor.type}-sheet.html`;\n  }\n\n  static get defaultOptions() {',
    );
    await writeFile(join(cwd, 'module', 'actor-sheet.mjs'), dynamic, 'utf8');
    const { report } = await runMigrateCommand({ cwd, sheets: true, out: () => {} });
    // An item template in the tree is not a candidate for an actor sheet; shared parts are.
    await mkdir(join(cwd, 'templates', 'item'), { recursive: true });
    await mkdir(join(cwd, 'templates', 'actor'), { recursive: true });
    await writeFile(
      join(cwd, 'templates', 'item', 'gear-sheet.html'),
      '<a class="item-create">+</a>\n',
      'utf8',
    );
    await writeFile(
      join(cwd, 'templates', 'actor', 'npc-sheet.html'),
      '<a class="item-create">+</a>\n',
      'utf8',
    );
    const second = await runMigrateCommand({ cwd, sheets: true, out: () => {} });
    expect(second.report.sheets?.templates.map((t) => t.file)).toEqual([
      'templates/actor-sheet.html',
      'templates/actor/npc-sheet.html',
    ]);
    expect(report.sheets?.templates.map((t) => t.file)).toEqual(['templates/actor-sheet.html']);
    expect(report.sheets?.files[0]?.todos.some((t) => /chosen at runtime/.test(t.message))).toBe(
      true,
    );
  });

  it('reports a file it cannot parse instead of stopping', async () => {
    await sheetProject();
    await writeFile(
      join(cwd, 'module', 'broken.mjs'),
      'class B extends ActorSheet { static get x() { return { a: 1 b: 2 }; } }\n',
      'utf8',
    );
    const { report } = await runMigrateCommand({ cwd, sheets: true, out: () => {} });
    expect(report.sheets?.files.map((f) => f.to)).toEqual(['module/actor-sheet.v2.mjs']);
    expect(
      report.sheets?.decisions.some((n) => /module\/broken\.mjs.*could not be parsed/.test(n)),
    ).toBe(true);
  });

  it('says so when there is no v1 sheet', async () => {
    const { report } = await runMigrateCommand({ cwd, sheets: true, out: () => {} });
    expect(report.sheets).toEqual({ files: [], templates: [], notes: [], decisions: [] });
  });
});

describe('vttforge migrate and the release workflow', () => {
  it('lists a workflow that ships the checkout of a project that builds to dist/', async () => {
    await mkdir(join(cwd, '.github', 'workflows'), { recursive: true });
    await writeFile(
      join(cwd, 'vite.config.mjs'),
      "import vttforge from '@vttforge/vite-plugin';\nexport default { plugins: [vttforge({ id: 'x' })] };\n",
      'utf8',
    );
    await writeFile(
      join(cwd, '.github', 'workflows', 'main.yml'),
      'on:\n  release:\n    types: [published]\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - run: zip -r ./system.zip system.json module/ templates/\n',
      'utf8',
    );
    let out = '';
    const { report } = await runMigrateCommand({
      cwd,
      out: (c) => {
        out += c;
      },
    });
    const workflow = report.files.find((f) => f.file === '.github/workflows/main.yml');
    expect(workflow?.notes[0]?.rule).toBe('VTTF-AUDIT-020');
    expect(workflow?.notes[0]?.line).toBe(9);
    expect(out).toMatch(
      /\.github\/workflows\/main\.yml\n {2}9: needs a decision: The release workflow zips the checkout without building/,
    );
  });
});

describe('--strict', () => {
  it('exits 1 when a decision is left, 0 when none is', async () => {
    await writeFile(
      join(cwd, 'chat.mjs'),
      'Hooks.on("renderChatMessage", (m, html) => html.find(".x"));\n',
      'utf8',
    );
    let out = '';
    const left = await runMigrateCommand({
      cwd,
      strict: true,
      out: (c) => {
        out += c;
      },
    });
    expect(left.exitCode).toBe(1);
    expect(out).toContain('--strict: 1 decision(s) left');
    await rm(join(cwd, 'chat.mjs'));
    const clean = await runMigrateCommand({ cwd, strict: true, out: () => undefined });
    expect(clean.exitCode).toBe(0);
  });

  it('does not fail on the notes that only say what to do next', async () => {
    // A sheet with nothing the codemod could not decide, and no template.json.
    await mkdir(join(cwd, 'templates'), { recursive: true });
    await writeFile(
      join(cwd, 'templates', 'hero.html'),
      '<form><a class="roll">r</a></form>\n',
      'utf8',
    );
    await writeFile(
      join(cwd, 'sheet.mjs'),
      `export class HeroSheet extends ActorSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, { template: 'systems/s/templates/hero.html' });
  }
  activateListeners(html) { super.activateListeners(html); html.find('.roll').click(() => this._onRoll()); }
  _onRoll() { return 1; }
}
`,
      'utf8',
    );
    const r = await runMigrateCommand({
      cwd,
      strict: true,
      sheets: true,
      dataModels: true,
      out: () => undefined,
    });
    expect(r.report.sheets?.files).toHaveLength(1);
    expect(r.report.sheets?.notes.length).toBeGreaterThan(0);
    expect(r.report.dataModels?.notes).toEqual(['No template.json here; nothing to generate.']);
    // The root <form> is the one real decision left; drop it and the run is clean.
    expect(r.report.sheets?.decisions).toHaveLength(1);
    expect(r.exitCode).toBe(1);
    await writeFile(
      join(cwd, 'templates', 'hero.html'),
      '<div><a class="roll">r</a></div>\n',
      'utf8',
    );
    const clean = await runMigrateCommand({
      cwd,
      strict: true,
      sheets: true,
      dataModels: true,
      out: () => undefined,
    });
    expect(clean.report.sheets?.decisions).toEqual([]);
    expect(clean.exitCode).toBe(0);
  });
});
