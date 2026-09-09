/**
 * VTTF-AUDIT-020 (HIGH): the release workflow ships the checkout, but the
 * project builds to `dist/`.
 *
 * A project on the vite plugin runs from `dist/`: the entry is bundled, the
 * manifest is copied and rewritten there. A release workflow written for the
 * old layout zips `system.json` and a list of source folders straight from
 * the checkout, and the published package has no entry file at all. Nothing
 * fails until a player installs it. This rule reads `.github/workflows` for
 * a workflow that publishes a zip and checks that it builds first and zips
 * `dist/`.
 */

import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import type { RuleResult } from './types.js';

const RULE_ID = 'VTTF-AUDIT-020';
const TITLE = 'Release workflow ships the checkout, not dist/';

const VITE_CONFIGS = [
  'vite.config.js',
  'vite.config.mjs',
  'vite.config.ts',
  'vite.config.mts',
  'vite.config.cjs',
];

/** A line that runs the build. */
const BUILD_STEP = /\b(?:vttforge\s+build|vite\s+build|(?:pnpm|npm|yarn|bun)\s+(?:run\s+)?build)\b/;
/** A line that makes or names the artifact. */
const ZIP_COMMAND = /\bzip\s+(?:-\S+\s+)*\S+\.zip\b|\bzip\s+-r\b/;
const ARTIFACT_LIST = /^\s*(?:artifacts|files|asset_path|path)\s*:/;
const MANIFEST = /\b(?:system|module)\.json\b/;
const RELEASE_ACTION = /(?:release-action|action-gh-release|upload-release-asset)/;

/** Whether this project builds through the vite plugin (or a `build` script that runs vite). */
async function buildsToDist(cwd: string): Promise<boolean> {
  for (const name of VITE_CONFIGS) {
    const path = join(cwd, name);
    if (!existsSync(path)) continue;
    const text = await readFile(path, 'utf8');
    if (/@vttforge\/vite-plugin|vttforge\s*\(/.test(text)) return true;
  }
  const pkg = join(cwd, 'package.json');
  if (!existsSync(pkg)) return false;
  try {
    const parsed = JSON.parse(await readFile(pkg, 'utf8')) as { scripts?: Record<string, string> };
    const build = parsed.scripts?.build ?? '';
    return /vttforge\s+build|vite\s+build/.test(build);
  } catch {
    return false;
  }
}

async function workflowFiles(cwd: string): Promise<string[]> {
  const dir = join(cwd, '.github', 'workflows');
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && /\.ya?ml$/.test(e.name))
    .map((e) => join(dir, e.name))
    .sort();
}

interface Shipping {
  /** 1-based line of the step that makes or names the artifact. */
  line: number;
  /** Whether that step reads from `dist/`. */
  fromDist: boolean;
  /** Whether a build ran before it. */
  builtBefore: boolean;
}

/** The first step that ships a package, or null when the workflow ships nothing. */
function shippingStep(text: string): Shipping | null {
  const lines = text.split('\n');
  let builtBefore = false;
  let inArtifactList = false;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? '';
    if (BUILD_STEP.test(line)) builtBefore = true;
    if (ZIP_COMMAND.test(line)) {
      // `cd dist && zip ...`, `zip -r ../x.zip dist/`, or a zip of the checkout's own files.
      const fromDist =
        /\bdist\b/.test(line) ||
        /\bcd\s+dist\b/.test(lines.slice(Math.max(0, i - 3), i).join('\n'));
      return { line: i + 1, fromDist, builtBefore };
    }
    if (ARTIFACT_LIST.test(line)) {
      inArtifactList = true;
      const inline = line.slice(line.indexOf(':') + 1);
      if (MANIFEST.test(inline) || /\.zip\b/.test(inline)) {
        return { line: i + 1, fromDist: /\bdist\//.test(inline), builtBefore };
      }
      continue;
    }
    if (inArtifactList) {
      if (/^\s*-?\s*\S/.test(line) && !/^\s*-\s/.test(line) && !/^\s{4,}\S/.test(line))
        inArtifactList = false;
      else if (MANIFEST.test(line) || /\.zip\b/.test(line)) {
        return { line: i + 1, fromDist: /\bdist\//.test(line), builtBefore };
      }
    }
  }
  return null;
}

/**
 * VTTF-AUDIT-020: a release workflow that publishes a zip must build first
 * and ship `dist/`.
 */
export async function runReleaseRules(cwd: string): Promise<RuleResult[]> {
  if (!(await buildsToDist(cwd))) return [];
  const findings: RuleResult[] = [];
  for (const file of await workflowFiles(cwd)) {
    const text = await readFile(file, 'utf8');
    const publishes =
      RELEASE_ACTION.test(text) || /\brelease\s*:/.test(text) || /\btags\s*:/.test(text);
    if (!publishes) continue;
    const ship = shippingStep(text);
    if (!ship) continue;
    const relPath = relative(cwd, file);
    if (!ship.builtBefore) {
      findings.push({
        ruleId: RULE_ID,
        title: TITLE,
        severity: 'HIGH',
        filePath: relPath,
        line: ship.line,
        message:
          'The release workflow zips the checkout without building it. This project bundles to dist/, so the published package has no entry file and no world can start on it.',
        remediation:
          'Install and build before the artifact step (`pnpm install --frozen-lockfile` then `pnpm build`), rewrite the manifest URLs in dist/system.json, and zip from inside dist/ so system.json and main.mjs sit at the zip root.',
      });
    } else if (!ship.fromDist) {
      findings.push({
        ruleId: RULE_ID,
        title: TITLE,
        severity: 'HIGH',
        filePath: relPath,
        line: ship.line,
        message:
          'The release workflow builds, then zips the source tree instead of dist/. The published package carries the unbundled entry and misses what the build wrote.',
        remediation:
          'Point the artifact step at dist/: rewrite the manifest URLs in dist/system.json and zip from inside dist/ (`cd dist && zip -r ../system.zip .`).',
      });
    }
  }
  return findings;
}
