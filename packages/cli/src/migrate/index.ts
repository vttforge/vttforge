/**
 * `vttforge migrate`: rewrite a v13 project for v14.
 *
 * Walks the same files the audit walks, applies the transforms, and reports
 * every edit and every thing it saw and would not decide for you. Nothing is
 * written unless asked: the preview is the default, because a text rewrite
 * that touched a string literal is something to see before it lands.
 */

import { existsSync } from 'node:fs';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { _internal } from '../audit/source-rules.js';
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
}

export interface MigrateOptions {
  cwd: string;
  /** Write the edits. Default false: report only. */
  write?: boolean;
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
  return {
    cwd,
    files,
    written: write,
    counts: {
      files: files.length,
      changes: files.reduce((n, f) => n + f.changes.length, 0),
      notes: files.reduce((n, f) => n + f.notes.length, 0),
    },
  };
}

/** The report as text: one block per file, edits then notes. */
export function formatMigrateReport(report: MigrateReport): string {
  const lines: string[] = [];
  if (report.files.length === 0) {
    lines.push('Nothing to migrate. The project already reads as v14.');
    return `${lines.join('\n')}\n`;
  }
  lines.push(
    report.written
      ? `Rewrote ${report.counts.changes} place(s) in ${report.counts.files} file(s).`
      : `Would rewrite ${report.counts.changes} place(s) in ${report.counts.files} file(s). Run again with --write to apply.`,
  );
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
  return `${lines.join('\n')}\n`;
}

function oneLine(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > 100 ? `${flat.slice(0, 97)}...` : flat;
}
