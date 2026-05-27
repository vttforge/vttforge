import { mkdtempSync, rmSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AuditTargetError, runAudit } from '../../audit/index.js';
import { runAuditCommand } from '../../commands/audit.js';

describe('runAudit (orchestrator)', () => {
  let cwd: string;

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), 'vttforge-audit-orch-'));
  });

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });

  it('returns an empty report for an empty project', async () => {
    const report = await runAudit({ cwd });
    expect(report.findings).toHaveLength(0);
    expect(report.counts).toEqual({ HIGH: 0, MEDIUM: 0, LOW: 0 });
    expect(report.cwd).toBe(cwd);
  });

  it('aggregates manifest + source findings into a single report', async () => {
    await writeFile(
      join(cwd, 'system.json'),
      JSON.stringify({
        id: 'my-system',
        version: '1.0.0',
        flags: { hotReload: ['css'] }, // VTTF-AUDIT-001 HIGH
        gridDistance: 5, // VTTF-AUDIT-002 MEDIUM
      }),
      'utf8',
    );
    await writeFile(
      join(cwd, 'data.ts'),
      `class CharacterData extends foundry.abstract.TypeDataModel {
  static defineSchema() { return {}; }
}`, // VTTF-AUDIT-005 MEDIUM
      'utf8',
    );

    const report = await runAudit({ cwd });
    expect(report.counts).toEqual({ HIGH: 1, MEDIUM: 2, LOW: 0 });
    expect(report.findings[0]?.severity).toBe('HIGH');
    expect(report.findings.map((f) => f.ruleId)).toEqual(
      expect.arrayContaining(['VTTF-AUDIT-001', 'VTTF-AUDIT-002', 'VTTF-AUDIT-005']),
    );
  });

  it('throws AuditTargetError when the path does not exist', async () => {
    const missing = join(cwd, 'does-not-exist');
    await expect(runAudit({ cwd: missing })).rejects.toThrow(AuditTargetError);
  });

  it('throws AuditTargetError when the path is a file (not a directory)', async () => {
    const filePath = join(cwd, 'a-file.txt');
    await writeFile(filePath, 'hi', 'utf8');
    await expect(runAudit({ cwd: filePath })).rejects.toThrow(/not a directory/);
  });

  it('sorts findings HIGH → MEDIUM → LOW', async () => {
    await writeFile(
      join(cwd, 'system.json'),
      JSON.stringify({
        id: 'my-system',
        version: '1.0.0',
        flags: { hotReload: ['css'] }, // HIGH
        gridDistance: 5, // MEDIUM
        styles: ['styles/a.css'], // LOW
      }),
      'utf8',
    );

    const report = await runAudit({ cwd });
    expect(report.findings[0]?.severity).toBe('HIGH');
    expect(report.findings[1]?.severity).toBe('MEDIUM');
    expect(report.findings[2]?.severity).toBe('LOW');
  });
});

describe('runAuditCommand (CLI surface)', () => {
  let cwd: string;
  let captured: string;

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), 'vttforge-audit-cmd-'));
    captured = '';
  });

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });

  const write = (chunk: string) => {
    captured += chunk;
  };

  it('writes markdown output by default and exits 0 on clean projects', async () => {
    const result = await runAuditCommand({ cwd, write });
    expect(result.exitCode).toBe(0);
    expect(captured).toContain('# vttforge audit report');
    expect(captured).toContain('No issues found');
  });

  it('writes JSON output when format is json', async () => {
    const result = await runAuditCommand({ cwd, format: 'json', write });
    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(captured);
    expect(parsed.findings).toEqual([]);
  });

  it('exits 1 when HIGH findings are present', async () => {
    await writeFile(
      join(cwd, 'system.json'),
      JSON.stringify({
        id: 'my-system',
        version: '1.0.0',
        flags: { hotReload: ['css'] },
      }),
      'utf8',
    );
    const result = await runAuditCommand({ cwd, write });
    expect(result.exitCode).toBe(1);
    expect(result.report.counts.HIGH).toBe(1);
  });

  it('exits 0 by default for MEDIUM/LOW-only findings (advisory mode)', async () => {
    await writeFile(
      join(cwd, 'system.json'),
      JSON.stringify({ id: 'my-system', version: '1.0.0', gridDistance: 5 }),
      'utf8',
    );
    const result = await runAuditCommand({ cwd, write });
    expect(result.exitCode).toBe(0);
    expect(result.report.counts.MEDIUM).toBe(1);
  });

  it('exits 1 in --strict for MEDIUM findings', async () => {
    await writeFile(
      join(cwd, 'system.json'),
      JSON.stringify({ id: 'my-system', version: '1.0.0', gridDistance: 5 }),
      'utf8',
    );
    const result = await runAuditCommand({ cwd, strict: true, write });
    expect(result.exitCode).toBe(1);
  });

  it('exits 1 in --strict for LOW findings', async () => {
    await writeFile(
      join(cwd, 'system.json'),
      JSON.stringify({ id: 'my-system', version: '1.0.0', styles: ['styles/a.css'] }),
      'utf8',
    );
    const result = await runAuditCommand({ cwd, strict: true, write });
    expect(result.exitCode).toBe(1);
  });
});
