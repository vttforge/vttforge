/**
 * `vttforge migrate`: the CLI surface over the v13 → v14 rewrite.
 *
 * Exit codes:
 *   0: ran, whether or not anything changed
 *   1: the target is not a directory
 */

import { resolve } from 'node:path';
import { formatMigrateReport, type MigrateReport, runMigrate } from '../migrate/index.js';

export interface MigrateCommandOptions {
  cwd?: string;
  write?: boolean;
  json?: boolean;
  /** Also generate a data model per template.json type. */
  dataModels?: boolean;
  style?: 'plain' | 'sdk';
  lang?: 'js' | 'ts';
  /** Also generate a V2 sheet file per Application v1 sheet class. */
  sheets?: boolean;
  /** Custom writer (tests). Defaults to process.stdout.write. */
  out?: (chunk: string) => void;
}

export async function runMigrateCommand(
  options: MigrateCommandOptions = {},
): Promise<{ report: MigrateReport; exitCode: 0 | 1 }> {
  const cwd = resolve(options.cwd ?? process.cwd());
  const out =
    options.out ??
    ((chunk: string) => {
      process.stdout.write(chunk);
    });
  const report = await runMigrate({
    cwd,
    write: options.write === true,
    dataModels: options.dataModels === true,
    style: options.style,
    lang: options.lang,
    sheets: options.sheets === true,
  });
  out(options.json ? `${JSON.stringify(report, null, 2)}\n` : formatMigrateReport(report));
  return { report, exitCode: 0 };
}
