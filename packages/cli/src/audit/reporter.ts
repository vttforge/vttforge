/**
 * Render an `AuditReport` as JSON (machine-readable, stable schema) or
 * markdown (terminal-friendly, sectioned by severity).
 *
 * JSON output is the contract for downstream CI tooling: stable shape,
 * stable severity strings, stable ruleId namespace `VTTF-AUDIT-NNN`. The
 * markdown variant exists so a human running `vttforge audit` in a
 * scrollback gets immediate signal without piping through `jq`.
 */

import { relative } from 'node:path';
import type { AuditReport, RuleResult } from './types.js';

export type ReportFormat = 'json' | 'markdown';

export function formatReport(report: AuditReport, format: ReportFormat): string {
  return format === 'json' ? formatJson(report) : formatMarkdown(report);
}

function formatJson(report: AuditReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}

function formatMarkdown(report: AuditReport): string {
  const { findings, counts, cwd } = report;
  const lines: string[] = [];
  lines.push('# vttforge audit report');
  lines.push('');
  lines.push(`- cwd: \`${cwd}\``);
  lines.push(`- started: ${report.startedAt}`);
  lines.push(
    `- findings: ${findings.length} (${counts.HIGH} HIGH · ${counts.MEDIUM} MEDIUM · ${counts.LOW} LOW)`,
  );
  lines.push('');
  if (findings.length === 0) {
    lines.push('No issues found. The system / module looks healthy against the v13 catalog.');
    lines.push('');
    return lines.join('\n');
  }

  for (const severity of ['HIGH', 'MEDIUM', 'LOW'] as const) {
    const bucket = findings.filter((f) => f.severity === severity);
    if (bucket.length === 0) continue;
    lines.push(`## ${severity} (${bucket.length})`);
    lines.push('');
    for (const finding of bucket) {
      lines.push(formatFinding(finding, cwd));
      lines.push('');
    }
  }
  return lines.join('\n');
}

function formatFinding(finding: RuleResult, cwd: string): string {
  const location = formatLocation(finding, cwd);
  const lines: string[] = [];
  lines.push(`### \`${finding.ruleId}\` — ${finding.title}`);
  lines.push('');
  lines.push(`- file: ${location}`);
  lines.push(`- message: ${finding.message}`);
  if (finding.remediation) {
    lines.push(`- fix: ${finding.remediation}`);
  }
  return lines.join('\n');
}

function formatLocation(finding: RuleResult, cwd: string): string {
  const rel = relativizeIfBelow(finding.filePath, cwd);
  return finding.line !== undefined ? `\`${rel}:${finding.line}\`` : `\`${rel}\``;
}

/**
 * Show paths relative to `cwd` when they live underneath it (cleaner reports),
 * fall back to the absolute path otherwise so we don't lie about where the
 * file actually is.
 */
function relativizeIfBelow(filePath: string, cwd: string): string {
  const rel = relative(cwd, filePath);
  if (rel === '' || rel.startsWith('..') || rel.startsWith('/')) {
    return filePath;
  }
  return rel;
}
