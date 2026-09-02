/**
 * Shared types for the `vttforge audit` rule engine.
 *
 * The audit catalog covers seven v13 footguns from the VTTForge audit
 * spec. Each rule produces zero or more `RuleResult` entries; the
 * orchestrator aggregates them into an `AuditReport` which the reporter
 * renders as JSON or markdown.
 *
 * The CLI never touches the source tree; audit is purely read-only.
 */

export type Severity = 'HIGH' | 'MEDIUM' | 'LOW';

export interface RuleResult {
  /** Stable identifier, used by users to suppress / pin / look up specific rules. */
  ruleId: string;
  /** Human title. Shown in markdown report headers. */
  title: string;
  severity: Severity;
  /** Absolute or project-relative path of the file the finding refers to. */
  filePath: string;
  /** Optional line number (1-based) inside `filePath`. */
  line?: number;
  /** One-line description of what was found. */
  message: string;
  /** Optional follow-up describing how to fix it. */
  remediation?: string;
}

export interface AuditReport {
  /** Project root the audit ran against. */
  cwd: string;
  /** ISO timestamp of when the run started. */
  startedAt: string;
  /** Findings, ordered by severity then by ruleId. */
  findings: ReadonlyArray<RuleResult>;
  /** Per-severity tallies, for exit-code logic and report headers. */
  counts: { HIGH: number; MEDIUM: number; LOW: number };
}

/** Severity rank for sorting (HIGH first). */
export const SEVERITY_RANK: Record<Severity, number> = {
  HIGH: 0,
  MEDIUM: 1,
  LOW: 2,
};

/**
 * A rule is a plain function over the project root. Manifest rules parse
 * `system.json` / `module.json`; source rules walk `scripts/` / `src/`.
 * Rules return their own findings; the orchestrator stitches them
 * together. Pure functions over the filesystem so tests inject tmp dirs.
 */
// (kept here for tests/library consumers that want to define their own rules)
export type RuleFn = (cwd: string) => Promise<RuleResult[]> | RuleResult[];
