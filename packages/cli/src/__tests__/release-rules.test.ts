/**
 * VTTF-AUDIT-020: a release workflow that ships the checkout of a project
 * that builds to dist/. The one failure that reaches players first.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runReleaseRules } from '../audit/release-rules.js';

const OLD_WORKFLOW = `name: Release Creation
on:
  release:
    types: [published]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: zip -r ./system.zip README.md system.json css/ lang/ module/ packs/ templates/
      - uses: ncipollo/release-action@v1
        with:
          artifacts: "./system.json, ./system.zip"
`;

const BUILT_WORKFLOW = `name: Release Creation
on:
  release:
    types: [published]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - run: |
          cd dist && zip -r ../system.zip .
      - uses: ncipollo/release-action@v1
        with:
          artifacts: "./dist/system.json, ./system.zip"
`;

const BUILT_BUT_SOURCE = `name: Release
on:
  push:
    tags: ['v*']
jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run build
      - run: zip -r system.zip system.json scripts/ templates/
      - uses: softprops/action-gh-release@v2
        with:
          files: |
            system.zip
            system.json
`;

describe('VTTF-AUDIT-020', () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = mkdtempSync(join(tmpdir(), 'vttforge-release-rule-'));
    await mkdir(join(cwd, '.github', 'workflows'), { recursive: true });
    await writeFile(
      join(cwd, 'vite.config.mjs'),
      "import vttforge from '@vttforge/vite-plugin';\nexport default { plugins: [vttforge({ id: 'x' })] };\n",
      'utf8',
    );
  });

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });

  it('flags a workflow that zips the checkout without building', async () => {
    await writeFile(join(cwd, '.github', 'workflows', 'main.yml'), OLD_WORKFLOW, 'utf8');
    const findings = await runReleaseRules(cwd);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe('HIGH');
    expect(findings[0]?.filePath).toBe('.github/workflows/main.yml');
    expect(findings[0]?.line).toBe(10);
    expect(findings[0]?.message).toMatch(/without building/);
  });

  it('flags a workflow that builds and then zips the source tree', async () => {
    await writeFile(join(cwd, '.github', 'workflows', 'release.yml'), BUILT_BUT_SOURCE, 'utf8');
    const findings = await runReleaseRules(cwd);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.line).toBe(12);
    expect(findings[0]?.message).toMatch(/instead of dist/);
  });

  it('accepts a workflow that builds and ships dist/', async () => {
    await writeFile(join(cwd, '.github', 'workflows', 'main.yml'), BUILT_WORKFLOW, 'utf8');
    expect(await runReleaseRules(cwd)).toEqual([]);
  });

  it('accepts the workflow the templates ship', async () => {
    const template = await import('node:fs/promises').then((fs) =>
      fs.readFile(
        new URL('../../templates/system-ts/.github/workflows/release.yml', import.meta.url),
        'utf8',
      ),
    );
    await writeFile(join(cwd, '.github', 'workflows', 'release.yml'), template, 'utf8');
    expect(await runReleaseRules(cwd)).toEqual([]);
  });

  it('says nothing for a project that does not build, or has no release workflow', async () => {
    await writeFile(join(cwd, '.github', 'workflows', 'main.yml'), OLD_WORKFLOW, 'utf8');
    rmSync(join(cwd, 'vite.config.mjs'));
    expect(await runReleaseRules(cwd)).toEqual([]);

    await writeFile(
      join(cwd, 'package.json'),
      '{ "scripts": { "build": "vttforge build" } }\n',
      'utf8',
    );
    rmSync(join(cwd, '.github', 'workflows', 'main.yml'));
    await writeFile(
      join(cwd, '.github', 'workflows', 'ci.yml'),
      'on: push\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - run: pnpm test\n',
      'utf8',
    );
    expect(await runReleaseRules(cwd)).toEqual([]);
  });
});
