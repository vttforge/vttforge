/**
 * `vttforge audit`: scan a system/module project against the VTTForge
 * audit catalog (seven v13 manifest + code footguns).
 *
 * The seven rules (VTTF-AUDIT-001 through 007) live in
 * `audit/manifest-rules.ts` or `audit/source-rules.ts`; this file is the
 * CLI surface that orchestrates them and prints the report.
 *
 * Exit codes:
 *   0: clean run, or only MEDIUM/LOW findings (informational)
 *   1: at least one HIGH finding (or any finding in `--strict` mode)
 */

import { resolve } from 'node:path';
import { runAudit } from '../audit/index.js';
import { formatReport, type ReportFormat } from '../audit/reporter.js';
import type { AuditReport } from '../audit/types.js';

export interface AuditOptions {
  /** Project root to scan. Defaults to `process.cwd()`. */
  cwd?: string;
  /** Output format. Default: 'markdown'. */
  format?: ReportFormat;
  /**
   * When true, MEDIUM and LOW findings also trigger a non-zero exit.
   * Default false: HIGH-only is the canonical "block CI" line.
   */
  strict?: boolean;
  /** Custom writer (tests). Defaults to process.stdout.write. */
  write?: (chunk: string) => void;
}

export interface AuditResult {
  report: AuditReport;
  /** Suggested exit code under the current strictness setting. */
  exitCode: 0 | 1;
}

export async function runAuditCommand(options: AuditOptions = {}): Promise<AuditResult> {
  const cwd = resolve(options.cwd ?? process.cwd());
  const format: ReportFormat = options.format ?? 'markdown';
  const strict = options.strict === true;
  const write =
    options.write ??
    ((chunk: string) => {
      process.stdout.write(chunk);
    });

  const report = await runAudit({ cwd });
  write(formatReport(report, format));

  const exitCode: 0 | 1 =
    report.counts.HIGH > 0 || (strict && (report.counts.MEDIUM > 0 || report.counts.LOW > 0))
      ? 1
      : 0;

  return { report, exitCode };
}
