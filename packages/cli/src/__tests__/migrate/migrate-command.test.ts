/**
 * The command over a real directory: preview by default, written on request.
 */
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
