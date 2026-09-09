/**
 * `vttforge migrate`: rewrite a v13 project for v14.
 *
 * Walks the same files the audit walks, applies the transforms, and reports
 * every edit and every thing it saw and would not decide for you. Nothing is
 * written unless asked: the preview is the default, because a text rewrite
 * that touched a string literal is something to see before it lands.
 */

import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { _internal } from '../audit/source-rules.js';
import { type EmitStyle, planDataModels } from './data-models.js';
import { editTemplate, readTabIds, type TemplateEdit } from './sheet-templates.js';
import { planSheetFile, type SheetPlanFile } from './sheets.js';
import { type Change, type Note, transformManifest, transformSource } from './transforms.js';

interface FileResult {
  /** Project-relative path. */
  file: string;
  changes: Change[];
  notes: Note[];
}

export interface MigrateReport {
  cwd: string;
  /** Files with at least one change or note. */
  files: FileResult[];
  /** Whether the edits were written to disk. */
  written: boolean;
  counts: { files: number; changes: number; notes: number };
  /** Present when data models were generated from template.json. */
  dataModels?: {
    files: string[];
    documentTypes: Record<string, Record<string, Record<string, unknown>>>;
    registration: string;
    notes: string[];
  };
  /** Present when V2 sheet files were generated from Application v1 classes. */
  sheets?: {
    files: Array<Omit<SheetPlanFile, 'source'>>;
    templates: Array<{ file: string; edits: TemplateEdit[]; formRoot: boolean }>;
    notes: string[];
  };
}

export interface MigrateOptions {
  cwd: string;
  /** Write the edits. Default false: report only. */
  write?: boolean;
  /** Also generate a data model per template.json type. */
  dataModels?: boolean;
  /** How the generated models are written: bare Foundry classes, or on the SDK's bases. */
  style?: EmitStyle;
  /** File extension of the generated models and sheets. */
  lang?: 'js' | 'ts';
  /** Also generate a V2 sheet file per Application v1 sheet class. */
  sheets?: boolean;
}

export async function runMigrate(options: MigrateOptions): Promise<MigrateReport> {
  const { cwd } = options;
  const write = options.write === true;
  if (!existsSync(cwd) || !(await stat(cwd)).isDirectory()) {
    throw new Error(`Migrate target is not a directory: ${cwd}`);
  }

  const files: FileResult[] = [];

  for (const [name, kind] of [
    ['system.json', 'system'],
    ['module.json', 'module'],
  ] as const) {
    const path = join(cwd, name);
    if (!existsSync(path)) continue;
    let raw: string;
    try {
      raw = await readFile(path, 'utf8');
      JSON.parse(raw);
    } catch {
      continue;
    }
    const result = transformManifest(raw, kind);
    if (result === null) continue;
    files.push({ file: name, changes: result.changes, notes: result.notes });
    if (write && result.changes.length > 0) await writeFile(path, result.output, 'utf8');
  }

  for await (const path of _internal.walkSourceFiles(cwd)) {
    let source: string;
    try {
      source = await readFile(path, 'utf8');
    } catch {
      continue;
    }
    const result = transformSource(source);
    if (result.changes.length === 0 && result.notes.length === 0) continue;
    files.push({ file: relative(cwd, path), changes: result.changes, notes: result.notes });
    if (write && result.output !== source) await writeFile(path, result.output, 'utf8');
  }

  files.sort((a, b) => a.file.localeCompare(b.file));
  const report: MigrateReport = {
    cwd,
    files,
    written: write,
    counts: {
      files: files.length,
      changes: files.reduce((n, f) => n + f.changes.length, 0),
      notes: files.reduce((n, f) => n + f.notes.length, 0),
    },
  };

  if (options.dataModels) {
    const templatePath = join(cwd, 'template.json');
    if (!existsSync(templatePath)) {
      report.dataModels = {
        files: [],
        documentTypes: {},
        registration: '',
        notes: ['No template.json here; nothing to generate.'],
      };
    } else {
      const template = JSON.parse(await readFile(templatePath, 'utf8')) as Record<string, unknown>;
      const plan = planDataModels(template, {
        style: options.style ?? 'plain',
        lang: options.lang ?? 'js',
      });
      const written: string[] = [];
      for (const file of plan.files) {
        const target = join(cwd, file.path);
        if (existsSync(target)) {
          plan.notes.unshift(`${file.path} exists and was left alone.`);
          continue;
        }
        if (write) {
          await mkdir(dirname(target), { recursive: true });
          await writeFile(target, file.source, 'utf8');
        }
        written.push(file.path);
      }
      report.dataModels = {
        files: written,
        documentTypes: plan.documentTypes,
        registration: plan.registration,
        notes: plan.notes,
      };
    }
  }

  if (options.sheets) report.sheets = await planSheets(cwd, write, options.lang ?? 'js');

  return report;
}

/** Every `.hbs` / `.html` under `templates/`, project-relative. */
async function allTemplates(cwd: string): Promise<string[]> {
  const root = join(cwd, 'templates');
  if (!existsSync(root)) return [];
  const out: string[] = [];
  const visit = async (dir: string): Promise<void> => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) await visit(full);
      else if (/\.(?:hbs|html)$/.test(entry.name)) out.push(relative(cwd, full));
    }
  };
  await visit(root);
  return out.sort();
}

/** Project-relative path for a Foundry template path such as `systems/<id>/templates/x.html`. */
function localTemplate(cwd: string, foundryPath: string): string | null {
  const m = /^(?:systems|modules)\/[^/]+\/(.+)$/.exec(foundryPath);
  const rel = m?.[1] ?? foundryPath;
  return existsSync(join(cwd, rel)) ? rel : null;
}

async function planSheets(
  cwd: string,
  write: boolean,
  lang: 'js' | 'ts',
): Promise<NonNullable<MigrateReport['sheets']>> {
  const files: Array<Omit<SheetPlanFile, 'source'>> = [];
  const templates: Array<{ file: string; edits: TemplateEdit[]; formRoot: boolean }> = [];
  const notes: string[] = [];
  const generated = new Map<string, string>();

  for await (const path of _internal.walkSourceFiles(cwd)) {
    const rel = relative(cwd, path);
    if (/\.v2\.[cm]?[jt]s$/.test(rel)) continue;
    let raw: string;
    try {
      raw = await readFile(path, 'utf8');
    } catch {
      continue;
    }
    if (!/\b(?:ActorSheet|ItemSheet)\b/.test(raw)) continue;
    // The generated file starts from the v14 rewrite of the source, so the bare
    // v13 aliases are already namespaced in it whether or not --write ran.
    const source = transformSource(raw).output;

    // First pass: which templates and nav selectors, so the tab ids can be read.
    let probe: ReturnType<typeof planSheetFile>;
    try {
      probe = planSheetFile(rel, source, { lang, tabIds: {} });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      notes.push(`${rel} could not be parsed and was skipped: ${reason}`);
      continue;
    }
    notes.push(...probe.notes);
    if (probe.files.length === 0) continue;
    let templatePaths = [...new Set(probe.files.flatMap((f) => f.templates))]
      .map((t) => localTemplate(cwd, t))
      .filter((t): t is string => t !== null);
    // A `get template()` that builds the path at runtime names nothing; every
    // sheet template in the project is a candidate then.
    if (templatePaths.length === 0) {
      const every = await allTemplates(cwd);
      // Leave out the other document's folder (item templates for an actor sheet and the
      // reverse); shared parts and dialogs stay in, since a sheet's rows often live there.
      const other =
        probe.files[0]?.base === 'BaseItemSheet' ? /(?:^|\/)actors?\//i : /(?:^|\/)items?\//i;
      templatePaths = every.filter((t) => !other.test(t));
    }
    const navSelectors = [...new Set(probe.files.flatMap((f) => f.tabNavSelectors))];
    const tabIds: Record<string, string[]> = {};
    for (const t of templatePaths) {
      const tpl = await readFile(join(cwd, t), 'utf8');
      for (const nav of navSelectors) {
        if (tabIds[nav]) continue;
        const ids = readTabIds(tpl, nav);
        if (ids.length > 0) tabIds[nav] = ids;
      }
    }

    const plan = planSheetFile(rel, source, { lang, tabIds });
    for (const f of plan.files) {
      const { source: out, ...rest } = f;
      files.push(rest);
      generated.set(f.to, out);
      notes.push(
        `Point registerSheet at ${f.className} from ${f.to} (a written key such as "<id>.${f.base === 'BaseActorSheet' ? 'actor' : 'item'}"), then delete the old class.`,
      );
    }
    const actions = plan.files.flatMap((f) =>
      f.actions.map((a) => ({ name: a.name, selector: a.selector })),
    );
    for (const t of templatePaths) {
      const tpl = await readFile(join(cwd, t), 'utf8');
      const r = editTemplate(tpl, { actions, navSelectors });
      // A template the class never touched (a dialog, a chat card) is not a sheet; its form is its own.
      if (r.edits.length === 0) continue;
      templates.push({ file: t, edits: r.edits, formRoot: r.formRoot });
      if (r.formRoot) {
        notes.push(
          `${t} opens with <form>; the SDK sheet already is one. Remove it once the old class is gone (audit rule 008).`,
        );
      }
      if (write && r.edits.length > 0) await writeFile(join(cwd, t), r.output, 'utf8');
    }
  }

  for (const [to, out] of generated) {
    const target = join(cwd, to);
    if (existsSync(target)) {
      notes.unshift(`${to} exists and was left alone.`);
      continue;
    }
    if (write) {
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, out, 'utf8');
    }
  }
  return { files, templates, notes: [...new Set(notes)] };
}

/** The report as text: one block per file, edits then notes. */
export function formatMigrateReport(report: MigrateReport): string {
  const lines: string[] = [];
  if (report.files.length === 0 && !report.dataModels && !report.sheets) {
    lines.push('Nothing to migrate. The project already reads as v14.');
    return `${lines.join('\n')}\n`;
  }
  if (report.files.length === 0) lines.push('Nothing to rewrite in the source or the manifest.');
  else {
    lines.push(
      report.written
        ? `Rewrote ${report.counts.changes} place(s) in ${report.counts.files} file(s).`
        : `Would rewrite ${report.counts.changes} place(s) in ${report.counts.files} file(s). Run again with --write to apply.`,
    );
  }
  for (const file of report.files) {
    lines.push('', `${file.file}`);
    for (const change of file.changes) {
      lines.push(
        `  ${change.line}: ${oneLine(change.before)}`,
        `  ${' '.repeat(String(change.line).length)}  → ${oneLine(change.after)}`,
      );
    }
    for (const note of file.notes) {
      lines.push(`  ${note.line}: needs a decision: ${note.message}`);
    }
  }
  if (report.counts.notes > 0) {
    lines.push(
      '',
      `${report.counts.notes} place(s) need a decision. Run \`vttforge audit\` after editing them.`,
    );
  }
  if (report.dataModels) {
    const dm = report.dataModels;
    lines.push(
      '',
      report.written
        ? `Wrote ${dm.files.length} data model file(s) from template.json:`
        : `Would write ${dm.files.length} data model file(s) from template.json:`,
    );
    for (const f of dm.files) lines.push(`  ${f}`);
    if (Object.keys(dm.documentTypes).length > 0) {
      lines.push(
        '',
        'Declare the types in the manifest:',
        `  "documentTypes": ${JSON.stringify(dm.documentTypes)}`,
      );
    }
    if (dm.registration)
      lines.push(
        '',
        'Register the models at init:',
        ...dm.registration.split('\n').map((l) => `  ${l}`),
      );
    for (const n of dm.notes) lines.push(`  needs a decision: ${n}`);
  }
  if (report.sheets) {
    const s = report.sheets;
    const targets = [...new Set(s.files.map((f) => f.to))];
    lines.push(
      '',
      report.written
        ? `Wrote ${targets.length} sheet file(s) on the SDK bases:`
        : `Would write ${targets.length} sheet file(s) on the SDK bases:`,
    );
    for (const f of s.files) {
      lines.push(`  ${f.to}: ${f.className} extends ${f.base}()`);
      for (const a of f.actions) lines.push(`    action ${a.name} ← ${a.selector} (${a.method})`);
      for (const t of f.todos) lines.push(`    ${t.line}: needs a decision: ${t.message}`);
    }
    if (s.templates.length > 0) {
      lines.push('', report.written ? 'Edited templates:' : 'Would edit templates:');
      for (const t of s.templates) {
        lines.push(`  ${t.file}`);
        for (const e of t.edits) {
          lines.push(
            `    ${e.line}: ${oneLine(e.before)}`,
            `    ${' '.repeat(String(e.line).length)}  → ${oneLine(e.after)}`,
          );
        }
      }
    }
    for (const n of s.notes) lines.push(`  needs a decision: ${n}`);
  }
  return `${lines.join('\n')}\n`;
}

function oneLine(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > 100 ? `${flat.slice(0, 97)}...` : flat;
}
