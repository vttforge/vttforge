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
 *   VTTF-AUDIT-009 (MEDIUM): a documentTypes subtype with no TYPES label
 *   VTTF-AUDIT-010 (HIGH)  : template.json erasing documentTypes metadata
 *
 * Each rule emits zero or more `RuleResult`s. Line numbers are looked up
 * cheaply by scanning the raw JSON for the offending key. Accurate
 * enough for navigation, no AST dependency.
 */

import { existsSync, readFileSync } from 'node:fs';
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
 * VTTF-AUDIT-009 (MEDIUM) — a declared subtype with no name.
 *
 * Foundry looks a subtype's label up under `TYPES.<Document>.<key>`, where a
 * module's key carries its id: `TYPES.Item.my-module.note`. With the label
 * missing it prints that path, so the sheet is titled
 * `TYPES.Item.my-module.note: Rope` and the Create dialog offers
 * `my-module.note` in its type dropdown.
 *
 * Nothing errors. The type works; it just has no name anywhere a reader
 * looks, which is the sort of thing that ships and stays.
 */
async function ruleTypeLabels(cwd: string, manifest: LoadedManifest): Promise<RuleResult[]> {
  const documentTypes = manifest.parsed.documentTypes;
  if (documentTypes === null || typeof documentTypes !== 'object') return [];

  const id = typeof manifest.parsed.id === 'string' ? manifest.parsed.id : null;
  if (id === null) return [];
  // A module namespaces its subtypes under its own id; a system does not.
  const isModule = manifest.path.endsWith('module.json');

  const languages = await loadLanguages(cwd, manifest);
  // Nothing to check against. Missing language files are their own problem.
  if (languages.length === 0) return [];

  const missing: string[] = [];
  for (const [document, subtypes] of Object.entries(documentTypes as Record<string, unknown>)) {
    if (subtypes === null || typeof subtypes !== 'object') continue;
    for (const subtype of Object.keys(subtypes as Record<string, unknown>)) {
      const path = isModule ? ['TYPES', document, id, subtype] : ['TYPES', document, subtype];
      const named = languages.some((catalogue) => readPath(catalogue, path) !== undefined);
      if (!named) missing.push(path.join('.'));
    }
  }
  if (missing.length === 0) return [];

  return [
    {
      ruleId: 'VTTF-AUDIT-009',
      title: 'Declared subtype has no name in any language file',
      severity: 'MEDIUM',
      filePath: manifest.path,
      line: findKeyLine(manifest.raw, 'documentTypes'),
      message: `No language file names ${missing.join(', ')}. Foundry falls back to printing the key, so the sheet title and the type dropdown read the raw path instead of a name.`,
      remediation: `Add the label to a language file, nested: ${nestedExample(missing[0] ?? '')}`,
    },
  ];
}

/** Every language catalogue the manifest declares, parsed. Unreadable ones are skipped. */
async function loadLanguages(
  cwd: string,
  manifest: LoadedManifest,
): Promise<Record<string, unknown>[]> {
  const declared = manifest.parsed.languages;
  if (!Array.isArray(declared)) return [];
  const out: Record<string, unknown>[] = [];
  for (const entry of declared) {
    if (entry === null || typeof entry !== 'object') continue;
    const path = (entry as { path?: unknown }).path;
    if (typeof path !== 'string') continue;
    try {
      out.push(JSON.parse(await readFile(join(cwd, path), 'utf8')));
    } catch {
      // Missing or malformed. Not this rule's finding to make.
    }
  }
  return out;
}

/**
 * Read a dotted path, allowing for either nesting.
 *
 * Foundry flattens its catalogues, so `{"TYPES.Item.x": "X"}` and the fully
 * nested form both work. A rule that only understood one shape would report
 * a label that is really there.
 */
function readPath(catalogue: Record<string, unknown>, path: readonly string[]): unknown {
  for (let split = path.length; split > 0; split -= 1) {
    const head = path.slice(0, split).join('.');
    const value = catalogue[head];
    if (value === undefined) continue;
    if (split === path.length) return value;
    if (value === null || typeof value !== 'object') continue;
    const rest = readPath(value as Record<string, unknown>, path.slice(split));
    if (rest !== undefined) return rest;
  }
  return undefined;
}

/** The JSON a reader should paste, for the first missing label. */
function nestedExample(dotted: string): string {
  const parts = dotted.split('.');
  let json = '"Some Name"';
  for (const key of parts.reverse()) json = `{ ${JSON.stringify(key)}: ${json} }`;
  return json;
}

/**
 * Entry point: run every manifest rule against every manifest at the
 * project root.
 */
/**
 * VTTF-AUDIT-010 (HIGH) — `template.json` erases the metadata that
 * `system.json` declares for the same type.
 *
 * On load, Foundry reads `template.json` and, for every type it lists,
 * replaces that type's entry in `documentTypes` with a fresh object. Into the
 * new object it copies only `htmlFields`, `filePathFields` and `gmOnlyFields`,
 * and it reads them from the document level of `template.json`, not from the
 * type. So this in `system.json`:
 *
 * ```json
 * "documentTypes": { "Actor": { "character": { "htmlFields": ["biography"] } } }
 * ```
 *
 * is thrown away the moment `template.json` lists `character` under `Actor`.
 *
 * Nothing errors, and the type still works. What is lost is every behaviour
 * that keys off those lists: HTML sanitization, ProseMirror enrichment, asset
 * path migration and search indexing. The field goes on saving and loading,
 * so the loss is invisible until a value comes back stripped or a path fails
 * to migrate.
 *
 * A system whose schemas come from `TypeDataModel` does not need
 * `template.json` at all: `documentTypes` declares the types and the data
 * model owns the shape.
 */
function ruleTemplateJsonShadowing(cwd: string, manifest: LoadedManifest): RuleResult[] {
  // Only a system manifest is affected; Foundry reads no template.json for a
  // module.
  if (!manifest.path.endsWith('system.json')) return [];

  const templatePath = join(cwd, 'template.json');
  if (!existsSync(templatePath)) return [];

  const documentTypes = manifest.parsed.documentTypes;
  if (documentTypes === null || typeof documentTypes !== 'object') return [];

  let template: Record<string, unknown>;
  try {
    template = JSON.parse(readFileSync(templatePath, 'utf8')) as Record<string, unknown>;
  } catch {
    // A template.json that will not parse is a different failure, and the
    // build reports it. Not this rule's business.
    return [];
  }

  const CARRIED = ['htmlFields', 'filePathFields', 'gmOnlyFields'] as const;
  const results: RuleResult[] = [];

  for (const [documentName, declared] of Object.entries(documentTypes as Record<string, unknown>)) {
    if (declared === null || typeof declared !== 'object') continue;
    const templateDoc = template[documentName];
    if (templateDoc === null || typeof templateDoc !== 'object') continue;
    const listed = (templateDoc as { types?: unknown }).types;
    if (!Array.isArray(listed)) continue;

    for (const [type, meta] of Object.entries(declared as Record<string, unknown>)) {
      if (!listed.includes(type)) continue;
      if (meta === null || typeof meta !== 'object') continue;

      // Only report what is actually lost. A bare `{}` loses nothing, and a
      // key already present at the document level survives the copy.
      const lost = CARRIED.filter(
        (key) => key in (meta as Record<string, unknown>) && !(key in templateDoc),
      );
      if (lost.length === 0) continue;

      results.push({
        ruleId: 'VTTF-AUDIT-010',
        title: 'template.json erases documentTypes metadata',
        severity: 'HIGH',
        filePath: 'template.json',
        line: findKeyLine(readFileSync(templatePath, 'utf8'), documentName),
        message: `template.json lists ${documentName} type "${type}", so Foundry replaces that type's documentTypes entry and drops ${lost.join(', ')} declared in system.json. Sanitization, enrichment and asset migration stop applying to those fields, silently.`,
        remediation:
          'Delete template.json. Your types are declared in system.json under `documentTypes`, and the schema comes from the TypeDataModel registered on `CONFIG.<Document>.dataModels`. If you still need it, move the lost keys up to the document level of template.json instead of the type.',
      });
    }
  }

  return results;
}

export async function runManifestRules(cwd: string): Promise<RuleResult[]> {
  const manifests = await loadManifests(cwd);
  const results: RuleResult[] = [];
  for (const manifest of manifests) {
    results.push(...ruleHotReload(manifest));
    results.push(...ruleGridShape(manifest));
    results.push(...ruleStylesShape(manifest));
    results.push(...(await ruleTypeLabels(cwd, manifest)));
    results.push(...ruleTemplateJsonShadowing(cwd, manifest));
  }
  return results;
}
