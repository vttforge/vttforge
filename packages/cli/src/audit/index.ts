/**
 * Audit orchestrator: runs every rule against a project root and
 * aggregates the findings into an `AuditReport`.
 *
 * Rule organisation:
 *   - manifest-rules.ts → VTTF-AUDIT-001, 002, 003 (manifest-only)
 *   - source-rules.ts   → VTTF-AUDIT-004, 005, 006, 007 (source walker
 *                         + cross-check with manifest where needed)
 *   - template-rules.ts → VTTF-AUDIT-008 (the Handlebars, cross-checked
 *                         against which base each sheet is built on)
 *
 * The orchestrator stays minimal. It knows which rule sets exist, but
 * the rules themselves are responsible for their own file IO. This keeps
 * the individual rule files testable in isolation.
 */

import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { runManifestRules } from './manifest-rules.js';
import { runSourceRules } from './source-rules.js';
import { runTemplateRules } from './template-rules.js';
import { type AuditReport, type RuleResult, SEVERITY_RANK } from './types.js';

export interface RunAuditOptions {
  cwd: string;
}

export class AuditTargetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuditTargetError';
  }
}

export async function runAudit(options: RunAuditOptions): Promise<AuditReport> {
  const cwd = resolve(options.cwd);
  // A missing or non-directory target must fail loudly. Otherwise both
  // rule sets return zero findings, the CLI prints "No issues found" and
  // exits 0, silently auditing nothing in CI. The mistyped-path failure
  // mode is invisible without this check.
  if (!existsSync(cwd)) {
    throw new AuditTargetError(`Audit target does not exist: ${cwd}`);
  }
  if (!statSync(cwd).isDirectory()) {
    throw new AuditTargetError(`Audit target is not a directory: ${cwd}`);
  }
  const startedAt = new Date().toISOString();

  const [manifestFindings, sourceFindings, templateFindings] = await Promise.all([
    runManifestRules(cwd),
    runSourceRules(cwd),
    runTemplateRules(cwd),
  ]);

  const findings: RuleResult[] = [...manifestFindings, ...sourceFindings, ...templateFindings].sort(
    compareFindings,
  );

  return {
    cwd,
    startedAt,
    findings,
    counts: countBySeverity(findings),
  };
}

/** Sort: HIGH first, then by ruleId for deterministic output. */
function compareFindings(a: RuleResult, b: RuleResult): number {
  const sev = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
  if (sev !== 0) return sev;
  if (a.ruleId !== b.ruleId) return a.ruleId.localeCompare(b.ruleId);
  return a.filePath.localeCompare(b.filePath);
}

function countBySeverity(findings: ReadonlyArray<RuleResult>): AuditReport['counts'] {
  const counts = { HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const f of findings) counts[f.severity] += 1;
  return counts;
}
