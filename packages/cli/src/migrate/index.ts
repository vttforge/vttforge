/**
 * `vttforge migrate`: rewrite a v13 project for v14.
 *
 * Walks the same files the audit walks, applies the transforms, and reports
 * every edit and every thing it saw and would not decide for you. Nothing is
 * written unless asked: the preview is the default, because a text rewrite
 * that touched a string literal is something to see before it lands.
 */

import { existsSync } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { runReleaseRules } from '../audit/release-rules.js';
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
    /** What happened, for the reader: a file left alone, nothing to generate. */
    notes: string[];
    /** What the generator could not decide: a guessed field, a template.json to delete. */
    decisions: string[];
  };
  /** Present when V2 sheet files were generated from Application v1 classes. */
  sheets?: {
    files: Array<Omit<SheetPlanFile, 'source'>>;
    templates: Array<{ file: string; edits: TemplateEdit[]; formRoot: boolean }>;
    /** What to do next: point registerSheet at the file, run the audit again. */
    notes: string[];
    /** What the codemod could not decide: a class it skipped, a root form to replace. */
    decisions: string[];
  };
}

/** A file the run will write once every rewrite has been computed. */
interface PendingWrite {
  path: string;
  content: string;
}

/**
 * The lines the report prints as "needs a decision": the rewrites the run did
 * not make, the TODO lines in generated files, and what the generators could
 * not decide. `--strict` fails the run when any is left. A note that only says
 * what happened (a file left alone, where to point registerSheet) is not one.
 */
export function countDecisions(report: MigrateReport): number {
  return (
    report.counts.notes +
    (report.dataModels?.decisions.length ?? 0) +
    (report.sheets?.files.reduce((n, f) => n + f.todos.length, 0) ?? 0) +
    (report.sheets?.decisions.length ?? 0)
  );
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
  // Every rewrite is computed before the first write, so a run that stops
  // halfway (a parser that throws on one file) leaves the tree as it was.
  const pending: PendingWrite[] = [];

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
    if (write && result.changes.length > 0) pending.push({ path, content: result.output });
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
    if (write && result.output !== source) pending.push({ path, content: result.output });
  }

  // A project that builds to dist/ with a release workflow written for the old
  // layout publishes a package with no entry file. Say so here, since the
  // rewrite is what moves the project onto the build.
  for (const finding of await runReleaseRules(cwd)) {
    files.push({
      file: finding.filePath,
      changes: [],
      notes: [
        {
          line: finding.line ?? 1,
          rule: finding.ruleId,
          message: `${finding.message} ${finding.remediation ?? ''}`.trim(),
        },
      ],
    });
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
        decisions: [],
      };
    } else {
      const template = JSON.parse(await readFile(templatePath, 'utf8')) as Record<string, unknown>;
      const plan = planDataModels(template, {
        style: options.style ?? 'plain',
        lang: options.lang ?? 'js',
      });
      const written: string[] = [];
      const info: string[] = [];
      for (const file of plan.files) {
        const target = join(cwd, file.path);
        if (existsSync(target)) {
          info.push(`${file.path} exists and was left alone.`);
          continue;
        }
        if (write) pending.push({ path: target, content: file.source });
        written.push(file.path);
      }
      report.dataModels = {
        files: written,
        documentTypes: plan.documentTypes,
        registration: plan.registration,
        notes: info,
        decisions: plan.notes,
      };
    }
  }

  if (options.sheets) report.sheets = await planSheets(cwd, write, options.lang ?? 'js', pending);

  for (const { path, content } of pending) {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content, 'utf8');
  }
  return report;
}

/** Every `.hbs` / `.html` in the project, project-relative. */
async function allTemplates(cwd: string): Promise<string[]> {
  const out: string[] = [];
  for await (const file of _internal.walkTemplateFiles(cwd)) out.push(relative(cwd, file));
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
  pending: PendingWrite[],
): Promise<NonNullable<MigrateReport['sheets']>> {
  const files: Array<Omit<SheetPlanFile, 'source'>> = [];
  const templates: Array<{ file: string; edits: TemplateEdit[]; formRoot: boolean }> = [];
  const notes: string[] = [];
  const decisions: string[] = [];
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
    if (
      !/\bextends\s+(?:foundry\.appv1\.\w+\.)?(?:ActorSheet|ItemSheet|FormApplication|Application)\b/.test(
        raw,
      )
    )
      continue;
    // The generated file starts from the v14 rewrite of the source, so the bare
    // v13 aliases are already namespaced in it whether or not --write ran.
    const source = transformSource(raw).output;

    // First pass: which templates and nav selectors, so the tab ids can be read.
    let probe: ReturnType<typeof planSheetFile>;
    try {
      probe = planSheetFile(rel, source, { lang, tabIds: {} });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      decisions.push(`${rel} could not be parsed and was skipped: ${reason}`);
      continue;
    }
    decisions.push(...probe.notes);
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
      const first = probe.files[0]?.base;
      const other =
        first === 'BaseItemSheet'
          ? /(?:^|\/)actors?\//i
          : first === 'BaseActorSheet'
            ? /(?:^|\/)items?\//i
            : null;
      templatePaths = other ? every.filter((t) => !other.test(t)) : every;
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
        `Run \`vttforge audit\` again after reading ${f.to}: the v14 rules also apply to the generated file.`,
      );
      notes.push(
        f.base === 'ApplicationV2'
          ? `Point whatever constructs ${f.className} (a settings menu, a macro, a button) at ${f.to}, then delete the old class.`
          : `Point registerSheet at ${f.className} from ${f.to} (a written key such as "<id>.${f.base === 'BaseActorSheet' ? 'actor' : 'item'}"), then delete the old class.`,
      );
    }
    const actions = plan.files.flatMap((f) =>
      f.actions.map((a) => ({ name: a.name, selector: a.selector })),
    );
    for (const t of templatePaths) {
      const tpl = await readFile(join(cwd, t), 'utf8');
      const primaryNav = navSelectors[0];
      const r = editTemplate(tpl, {
        actions,
        navSelectors,
        tabIds: primaryNav === undefined ? undefined : tabIds[primaryNav],
      });
      // A template the class never touched (a dialog, a chat card) is not a sheet; its form is its own.
      if (r.edits.length === 0) continue;
      templates.push({ file: t, edits: r.edits, formRoot: r.formRoot });
      if (r.formRoot) {
        decisions.push(
          `${t} opens with <form>; the SDK sheet already is one. Make it a <div> once the old class is gone: a part needs one root element (audit rule 008).`,
        );
      }
      if (write && r.edits.length > 0) pending.push({ path: join(cwd, t), content: r.output });
    }
  }

  for (const [to, out] of generated) {
    const target = join(cwd, to);
    if (existsSync(target)) {
      notes.unshift(`${to} exists and was left alone.`);
      continue;
    }
    if (write) pending.push({ path: target, content: out });
  }
  return { files, templates, notes: [...new Set(notes)], decisions: [...new Set(decisions)] };
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
    for (const n of dm.notes) lines.push(`  ${n}`);
    for (const n of dm.decisions) lines.push(`  needs a decision: ${n}`);
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
      lines.push(
        `  ${f.to}: ${f.className} extends ${f.base === 'ApplicationV2' ? 'HandlebarsApplicationMixin(ApplicationV2)' : `${f.base}()`}`,
      );
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
    for (const n of s.notes) lines.push(`  ${n}`);
    for (const n of s.decisions) lines.push(`  needs a decision: ${n}`);
  }
  return `${lines.join('\n')}\n`;
}

function oneLine(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > 100 ? `${flat.slice(0, 97)}...` : flat;
}
