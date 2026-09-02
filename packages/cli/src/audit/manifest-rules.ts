/**
 * Manifest-scope audit rules.
 *
 * These rules operate on the parsed contents of `system.json` and/or
 * `module.json` at the project root. They cover three v13 manifest
 * footguns from the VTTForge audit catalog:
 *
 *   VTTF-AUDIT-001 (HIGH)  : flags.hotReload shape
 *   VTTF-AUDIT-002 (MEDIUM): deprecated gridDistance/gridUnits
 *   VTTF-AUDIT-003 (LOW)   : styles array of strings (v12 shape)
 *
 * Each rule emits zero or more `RuleResult`s. Line numbers are looked up
 * cheaply by scanning the raw JSON for the offending key. Accurate
 * enough for navigation, no AST dependency.
 */

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { RuleResult } from './types.js';

const MANIFEST_FILES = ['system.json', 'module.json'] as const;

interface LoadedManifest {
  path: string;
  raw: string;
  parsed: Record<string, unknown>;
}

/**
 * Load the manifest(s) at the project root. Returns at most two entries
 * (system + module), skipping anything that can't be parsed as a JSON
 * object. We tolerate parse errors here because that's a separate failure
 * mode the user will hit when they actually run `vite build`; the audit
 * shouldn't double-report it.
 */
async function loadManifests(cwd: string): Promise<LoadedManifest[]> {
  const out: LoadedManifest[] = [];
  for (const file of MANIFEST_FILES) {
    const path = join(cwd, file);
    if (!existsSync(path)) continue;
    let raw: string;
    try {
      raw = await readFile(path, 'utf8');
    } catch {
      continue;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      out.push({ path, raw, parsed: parsed as Record<string, unknown> });
    }
  }
  return out;
}

/**
 * Find the 1-based line number of the first `"key":` occurrence in JSON
 * source. Good enough for navigation: JSON keys are usually unique at
 * the level we report on, and even when nested duplicates exist the
 * first occurrence points at the right region of the file.
 */
function findKeyLine(raw: string, key: string): number | undefined {
  const needle = `"${key}"`;
  const idx = raw.indexOf(needle);
  if (idx < 0) return undefined;
  let line = 1;
  for (let i = 0; i < idx; i += 1) {
    if (raw[i] === '\n') line += 1;
  }
  return line;
}

/**
 * VTTF-AUDIT-001 (HIGH): flags.hotReload shape.
 *
 * v12 accepted `"hotReload": ["css", "hbs", ...]` (array). v13 expects
 * `"hotReload": { "extensions": [...], "paths": [...] }` (object at the
 * root of `flags`, NOT nested under a package id). With the array shape
 * the server's chokidar watcher reads `.extensions` and gets undefined,
 * silently disabling HMR for the package.
 */
function ruleHotReload(manifest: LoadedManifest): RuleResult[] {
  const flags = manifest.parsed.flags;
  if (!flags || typeof flags !== 'object' || Array.isArray(flags)) return [];
  const hr = (flags as Record<string, unknown>).hotReload;
  if (hr === undefined) return [];

  const line = findKeyLine(manifest.raw, 'hotReload');
  if (Array.isArray(hr)) {
    return [
      {
        ruleId: 'VTTF-AUDIT-001',
        title: 'flags.hotReload uses the deprecated v12 array shape',
        severity: 'HIGH',
        filePath: manifest.path,
        line,
        message:
          'flags.hotReload is an array; v13 expects an object `{ "extensions": [...], "paths": [...] }`. With the array shape Foundry silently disables HMR for this package.',
        remediation:
          'Replace the array with an object: `"hotReload": { "extensions": ["css", "hbs", "json"], "paths": ["styles", "templates", "lang"] }`.',
      },
    ];
  }
  // `typeof null === 'object'` would slip past a naive check, so the
  // null / scalar / array branches are all rejected explicitly before
  // we trust hr as an object.
  if (hr === null || typeof hr !== 'object') {
    return [
      {
        ruleId: 'VTTF-AUDIT-001',
        title: 'flags.hotReload has an invalid shape',
        severity: 'HIGH',
        filePath: manifest.path,
        line,
        message: 'flags.hotReload must be an object with `extensions` and `paths` arrays in v13.',
        remediation: 'Replace with `"hotReload": { "extensions": [...], "paths": [...] }`.',
      },
    ];
  }
  // Object shape: `extensions` is mandatory (Foundry has no default for
  // which extensions to watch), but `paths` is optional: when omitted,
  // Foundry watches the entire package root. Don't penalise users who
  // legitimately want the broader watch scope.
  const hrObj = hr as Record<string, unknown>;
  if (!Array.isArray(hrObj.extensions)) {
    return [
      {
        ruleId: 'VTTF-AUDIT-001',
        title: 'flags.hotReload is missing the required `extensions` key',
        severity: 'HIGH',
        filePath: manifest.path,
        line,
        message:
          'flags.hotReload must declare an `extensions` array. Foundry has no default and the watcher silently does nothing without it.',
        remediation:
          'Add `extensions`: `"hotReload": { "extensions": ["css", "hbs", "json"], "paths": ["styles", "templates", "lang"] }`. `paths` is optional (defaults to the package root) but recommended.',
      },
    ];
  }
  return [];
}

/**
 * VTTF-AUDIT-002 (MEDIUM): deprecated top-level grid fields.
 *
 * v12 used flat `gridDistance` + `gridUnits`. v13 wants
 * `grid: { type, distance, units, diagonals }`. The legacy keys still
 * work today (Foundry auto-migrates and warns) but will be removed in
 * v14. Flag them now so the project is forward-compatible.
 */
function ruleGridShape(manifest: LoadedManifest): RuleResult[] {
  const hasLegacyDistance = 'gridDistance' in manifest.parsed;
  const hasLegacyUnits = 'gridUnits' in manifest.parsed;
  if (!hasLegacyDistance && !hasLegacyUnits) return [];

  const offendingKey = hasLegacyDistance ? 'gridDistance' : 'gridUnits';
  return [
    {
      ruleId: 'VTTF-AUDIT-002',
      title: 'Top-level gridDistance / gridUnits are deprecated v12 fields',
      severity: 'MEDIUM',
      filePath: manifest.path,
      line: findKeyLine(manifest.raw, offendingKey),
      message:
        'gridDistance and gridUnits at the manifest root are the v12 shape. Foundry v13 expects a structured `grid` object and emits a deprecation warning on load; the fields will be removed in v14.',
      remediation:
        'Replace with `"grid": { "type": 1, "distance": 5, "units": "ft", "diagonals": 0 }` (adjust values to your system).',
    },
  ];
}

/**
 * VTTF-AUDIT-003 (LOW): styles array of strings.
 *
 * v12 took `styles: ["styles/foo.css"]`. v13 expects `styles: [{ src,
 * layer? }]` so cascade-layer ordering can be declared in the manifest.
 * The string form still works (Foundry auto-migrates) but emits a
 * deprecation warning and loses the ability to control layer placement.
 */
function ruleStylesShape(manifest: LoadedManifest): RuleResult[] {
  const styles = manifest.parsed.styles;
  if (!Array.isArray(styles) || styles.length === 0) return [];

  // The whole array is uniform in the v12 shape: entries are strings.
  // Mixed arrays (some string, some object) also fail v13 expectations.
  const hasString = styles.some((entry) => typeof entry === 'string');
  if (!hasString) return [];

  return [
    {
      ruleId: 'VTTF-AUDIT-003',
      title: 'styles uses the deprecated v12 string-array shape',
      severity: 'LOW',
      filePath: manifest.path,
      line: findKeyLine(manifest.raw, 'styles'),
      message:
        'styles entries should be objects of the form `{ "src": "path/to.css", "layer": "optional-layer" }` in v13. String entries auto-migrate today but the conversion drops your control over cascade-layer placement.',
      remediation:
        'Replace each string with `{ "src": "<that-path>" }`. Add a `"layer"` field per entry where you want explicit cascade ordering.',
    },
  ];
}

/**
 * Entry point: run every manifest rule against every manifest at the
 * project root.
 */
export async function runManifestRules(cwd: string): Promise<RuleResult[]> {
  const manifests = await loadManifests(cwd);
  const results: RuleResult[] = [];
  for (const manifest of manifests) {
    results.push(...ruleHotReload(manifest));
    results.push(...ruleGridShape(manifest));
    results.push(...ruleStylesShape(manifest));
  }
  return results;
}
