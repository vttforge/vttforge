import { describe, expect, it } from 'vitest';
import { formatReport } from '../../audit/reporter.js';
import type { AuditReport, RuleResult } from '../../audit/types.js';

function makeReport(findings: RuleResult[]): AuditReport {
  return {
    cwd: '/projects/my-system',
    startedAt: '2026-05-27T00:00:00.000Z',
    findings,
    counts: {
      HIGH: findings.filter((f) => f.severity === 'HIGH').length,
      MEDIUM: findings.filter((f) => f.severity === 'MEDIUM').length,
      LOW: findings.filter((f) => f.severity === 'LOW').length,
    },
  };
}

const highFinding: RuleResult = {
  ruleId: 'VTTF-AUDIT-001',
  title: 'flags.hotReload shape',
  severity: 'HIGH',
  filePath: '/projects/my-system/system.json',
  line: 34,
  message: 'flags.hotReload is an array; v13 expects {extensions, paths}',
  remediation: 'Replace `["css","hbs"]` with `{ "extensions": [...], "paths": [...] }`.',
};

const mediumFinding: RuleResult = {
  ruleId: 'VTTF-AUDIT-002',
  title: 'Deprecated grid shape',
  severity: 'MEDIUM',
  filePath: '/projects/my-system/system.json',
  line: 26,
  message:
    'gridDistance/gridUnits are v12 fields; v13 wants `grid: {type, distance, units, diagonals}`',
};

describe('formatReport — JSON', () => {
  it('emits a stable JSON envelope', () => {
    const json = formatReport(makeReport([highFinding]), 'json');
    const parsed = JSON.parse(json);
    expect(parsed.cwd).toBe('/projects/my-system');
    expect(parsed.findings).toHaveLength(1);
    expect(parsed.findings[0].ruleId).toBe('VTTF-AUDIT-001');
    expect(parsed.counts).toEqual({ HIGH: 1, MEDIUM: 0, LOW: 0 });
  });

  it('ends with a trailing newline (POSIX convention)', () => {
    const json = formatReport(makeReport([]), 'json');
    expect(json.endsWith('\n')).toBe(true);
  });
});

describe('formatReport — markdown', () => {
  it('renders a "no issues" body when findings are empty', () => {
    const md = formatReport(makeReport([]), 'markdown');
    expect(md).toContain('# vttforge audit report');
    expect(md).toContain('No issues found');
  });

  it('groups findings by severity with counts', () => {
    const md = formatReport(makeReport([highFinding, mediumFinding]), 'markdown');
    expect(md).toContain('## HIGH (1)');
    expect(md).toContain('## MEDIUM (1)');
    expect(md).toContain('VTTF-AUDIT-001');
    expect(md).toContain('VTTF-AUDIT-002');
  });

  it('uses relative paths when files live under cwd', () => {
    const md = formatReport(makeReport([highFinding]), 'markdown');
    expect(md).toContain('`system.json:34`');
    expect(md).not.toContain('/projects/my-system/system.json');
  });

  it('keeps the absolute path when the file is outside cwd', () => {
    const outside: RuleResult = { ...highFinding, filePath: '/other/place/system.json' };
    const md = formatReport(makeReport([outside]), 'markdown');
    expect(md).toContain('/other/place/system.json');
  });

  it('omits the line suffix when no line is present', () => {
    const noLine: RuleResult = { ...highFinding, line: undefined };
    const md = formatReport(makeReport([noLine]), 'markdown');
    expect(md).toContain('`system.json`');
    expect(md).not.toContain(':34');
  });

  it('renders the remediation hint when provided', () => {
    const md = formatReport(makeReport([highFinding]), 'markdown');
    expect(md).toContain('Replace `["css","hbs"]`');
  });

  it('skips the fix line when remediation is omitted', () => {
    const md = formatReport(makeReport([mediumFinding]), 'markdown');
    expect(md).not.toContain('fix:');
  });

  it('shows the totals header even when there are findings', () => {
    const md = formatReport(makeReport([highFinding, mediumFinding]), 'markdown');
    expect(md).toContain('findings: 2 (1 HIGH · 1 MEDIUM · 0 LOW)');
  });
});
