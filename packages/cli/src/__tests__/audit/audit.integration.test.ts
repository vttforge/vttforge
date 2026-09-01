/**
 * End-to-end smoke: scaffold each of the four templates and audit the
 * result. Templates are the canonical "compliant" inputs — the audit
 * must report zero findings against them. If this test fails it means
 * either a template regressed against v13 conventions, or the audit
 * grew a false positive against the official scaffolds.
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runAudit } from '../../audit/index.js';
import { type ScaffoldVars, scaffold, templatesRoot } from '../../scaffold.js';

const VARS: ScaffoldVars = {
  ID: 'audit-smoke',
  TITLE: 'Audit Smoke',
  DESCRIPTION: 'Audit integration test scaffold.',
  AUTHOR: 'Daisy',
  LICENSE: 'MIT',
  FOUNDRY_MIN_VERSION: '13',
  FOUNDRY_VERIFIED_VERSION: '13.341',
  LOCALE_PREFIX: 'AUDIT_SMOKE',
  YEAR: '2026',
};

describe.each(['system-ts', 'system-js', 'module-ts', 'module-js'])(
  'audit clean against %s template',
  (variant) => {
    let dest: string;

    beforeEach(async () => {
      dest = mkdtempSync(join(tmpdir(), `vttforge-audit-${variant}-`));
      await scaffold({
        templateDir: join(templatesRoot(), variant),
        destDir: dest,
        vars: VARS,
      });
    });

    afterEach(() => {
      rmSync(dest, { recursive: true, force: true });
    });

    it('emits zero findings', async () => {
      const report = await runAudit({ cwd: dest });
      expect(report.findings).toEqual([]);
      expect(report.counts).toEqual({ HIGH: 0, MEDIUM: 0, LOW: 0 });
    });
  },
);
