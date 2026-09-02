/**
 * Source-tree audit rules.
 *
 * These walk `.ts` / `.tsx` / `.mjs` / `.cjs` / `.js` files under the
 * project root (excluding common build/dependency dirs) and apply regex
 * heuristics to spot four v13 footguns from the VTTForge audit catalog:
 *
 *   VTTF-AUDIT-004 (MEDIUM) — HTMLField/FilePathField missing manifest declaration
 *   VTTF-AUDIT-005 (MEDIUM) — extends TypeDataModel without prepareBaseData stub
 *   VTTF-AUDIT-006 (LOW)    — `_addDataFieldMigrations` override (wrong signature)
 *   VTTF-AUDIT-007 (MEDIUM) — manifest primary/secondaryTokenAttribute not matched
 *                             by a `value`/`max` SchemaField in source
 *
 * Regex-based on purpose: avoids pulling in a TypeScript AST dependency
 * for what amount to four pattern checks. The trade-off is occasional
 * false negatives on heavily-formatted code; the alternative would be a
 * 30MB+ runtime dep for marginal gains.
 */

import { existsSync } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { RuleResult } from './types.js';

/** Directories we never descend into — they're not user source. */
const EXCLUDED_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  '.git',
  '.turbo',
  '.vttforge',
  '.next',
  'coverage',
  '.vitest-cache',
]);

// `.mts`/`.cts` are valid TS ESM/CJS source files; `.d.ts`/`.d.mts`/`.d.cts`
// are declaration-only and skipped (no real source to scan).
const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.mjs', '.cjs', '.js'] as const;

function isSourceFile(name: string): boolean {
  if (name.endsWith('.d.ts') || name.endsWith('.d.mts') || name.endsWith('.d.cts')) {
    return false;
  }
  return SOURCE_EXTENSIONS.some((ext) => name.endsWith(ext));
}

async function* walkSourceFiles(cwd: string): AsyncGenerator<string> {
  const entries = await readdir(cwd, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.') && EXCLUDED_DIRS.has(entry.name)) continue;
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      yield* walkSourceFiles(join(cwd, entry.name));
    } else if (entry.isFile() && isSourceFile(entry.name)) {
      yield join(cwd, entry.name);
    }
  }
}

/** Find the 1-based line number of the first occurrence of `needle`. */
function lineOf(content: string, needle: string | RegExp): number | undefined {
  const idx = typeof needle === 'string' ? content.indexOf(needle) : content.search(needle);
  if (idx < 0) return undefined;
  let line = 1;
  for (let i = 0; i < idx; i += 1) {
    if (content[i] === '\n') line += 1;
  }
  return line;
}

/** VTTF-AUDIT-005 — `extends TypeDataModel` without a `prepareBaseData(...)` method. */
function rule005(filePath: string, content: string): RuleResult[] {
  // Find every direct TypeDataModel subclass with its body extents so we
  // can check each class independently. The previous file-wide check
  // would pass a whole file if ANY class in it had prepareBaseData; that
  // silently let sibling subclasses miss the hook.
  const out: RuleResult[] = [];
  const directClasses = findDirectTypeDataModelClasses(content);
  for (const cls of directClasses) {
    const body = content.slice(cls.openIdx + 1, cls.endIdx);
    if (/prepareBaseData\s*\(/.test(body)) continue;
    out.push({
      ruleId: 'VTTF-AUDIT-005',
      title: 'TypeDataModel subclass missing prepareBaseData stub',
      severity: 'MEDIUM',
      filePath,
      line: cls.startLine,
      message: `Class \`${cls.className}\` extends TypeDataModel directly but does not define prepareBaseData(). Active Effects apply between prepareBaseData and prepareDerivedData; without the hook, AE consumers see uninitialised fields.`,
      remediation:
        'Add a no-op `prepareBaseData()` method (or extend `BaseTypeDataModel()` from `@vttforge/core`, which provides the stub).',
    });
  }
  return out;
}

/**
 * Subset of `findClassRanges` that only returns classes whose `extends`
 * names `TypeDataModel` (and not via the `BaseTypeDataModel()` factory).
 * The word boundary in `\bTypeDataModel\b` keeps the factory pattern
 * out, same as the lower-level helper.
 */
function findDirectTypeDataModelClasses(content: string): ClassRange[] {
  const re = /class\s+(\w+)\s+extends\s+(?:[\w.]+\.)?\bTypeDataModel\b[^{]*\{/g;
  const out: ClassRange[] = [];
  for (const match of content.matchAll(re)) {
    if (match.index === undefined) continue;
    const openIdx = match.index + match[0].length - 1;
    let depth = 0;
    let endIdx = -1;
    for (let i = openIdx; i < content.length; i += 1) {
      if (content[i] === '{') depth += 1;
      else if (content[i] === '}') {
        depth -= 1;
        if (depth === 0) {
          endIdx = i;
          break;
        }
      }
    }
    if (endIdx < 0) continue;
    let line = 1;
    for (let i = 0; i < match.index; i += 1) {
      if (content[i] === '\n') line += 1;
    }
    out.push({ className: match[1] ?? '(anonymous)', startLine: line, openIdx, endIdx });
  }
  return out;
}

/** VTTF-AUDIT-006 — `_addDataFieldMigrations(` override on a TypeDataModel subclass. */
function rule006(filePath: string, content: string): RuleResult[] {
  if (!/_addDataFieldMigrations\s*\(/.test(content)) return [];
  // Only flag when the file defines a TypeDataModel-derived class — direct
  // `TypeDataModel` OR the VTTForge `BaseTypeDataModel()` factory. The
  // factory case matters because templates lean on it; an override there
  // is the most likely place users would write the buggy signature.
  if (!/extends\s+(?:[\w.]+\.)?(?:Base)?TypeDataModel\b/.test(content)) return [];
  return [
    {
      ruleId: 'VTTF-AUDIT-006',
      title: 'Method name confused with Foundry migration API',
      severity: 'LOW',
      filePath,
      line: lineOf(content, /_addDataFieldMigrations\s*\(/),
      message:
        'The plural `_addDataFieldMigrations` is not a real Foundry API. The canonical v13 migration hook is a static `migrateData(source)` override that calls singular `super._addDataFieldMigration(source, oldKey, newKey, apply?)` for each rename. Instance overrides named `_addDataFieldMigrations` never run.',
      remediation:
        'Replace the override with `static migrateData(source) { super._addDataFieldMigration(source, "oldKey", "newKey"); return super.migrateData(source); }`.',
    },
  ];
}

/**
 * Track each class declaration's brace-balanced range so we can ask
 * "which class encloses position X?" later. Without this, rule 004 has
 * to fall back to a global declared-fields union, which silently passes
 * when two subtypes share a field name but only one declares it.
 */
interface ClassRange {
  className: string;
  startLine: number;
  openIdx: number;
  endIdx: number;
}

function findClassRanges(content: string): ClassRange[] {
  const out: ClassRange[] = [];
  const re = /class\s+(\w+)(?:\s+extends\s+[^{]+)?\{/g;
  for (const match of content.matchAll(re)) {
    if (match.index === undefined) continue;
    const openIdx = match.index + match[0].length - 1;
    let depth = 0;
    let endIdx = -1;
    for (let i = openIdx; i < content.length; i += 1) {
      if (content[i] === '{') depth += 1;
      else if (content[i] === '}') {
        depth -= 1;
        if (depth === 0) {
          endIdx = i;
          break;
        }
      }
    }
    if (endIdx < 0) continue;
    let line = 1;
    for (let i = 0; i < match.index; i += 1) {
      if (content[i] === '\n') line += 1;
    }
    out.push({ className: match[1] ?? '(anonymous)', startLine: line, openIdx, endIdx });
  }
  return out;
}

function findEnclosingClass(ranges: ClassRange[], idx: number): string | undefined {
  // Inner class wins (later in the array, since classes are flat in typical
  // Foundry code). Iterate in reverse so a nested class beats its parent.
  for (let i = ranges.length - 1; i >= 0; i -= 1) {
    const r = ranges[i];
    if (!r) continue;
    if (idx >= r.openIdx && idx <= r.endIdx) return r.className;
  }
  return undefined;
}

/**
 * A class built on the `BaseTypeDataModel(defineSchema)` factory keeps its
 * schema in a function outside the class body. Rules that ask "which class
 * owns this field" would otherwise see the field as unowned. So the body of
 * that function is reported as a range owned by the class, alongside the
 * class's own body.
 *
 * Both the arrow and the `function` form are recognised, as long as the
 * function is named and passed by name. An inline arrow is already inside
 * the `class ... {` match and needs no help.
 */
function findSchemaFactoryRanges(content: string): ClassRange[] {
  const out: ClassRange[] = [];
  const classRe = /class\s+(\w+)\s+extends\s+(?:[\w.]+\.)?BaseTypeDataModel\s*\(\s*(\w+)\s*\)/g;
  for (const match of content.matchAll(classRe)) {
    const className = match[1];
    const fnName = match[2];
    if (!className || !fnName) continue;
    const fnRe = new RegExp(
      String.raw`(?:(?:const|let|var)\s+${fnName}\s*=\s*(?:async\s*)?(?:\([^)]*\)|\w+)\s*=>\s*\(?\s*\{|function\s+${fnName}\s*\([^)]*\)\s*\{)`,
    );
    const fnMatch = fnRe.exec(content);
    if (fnMatch === null) continue;
    const openIdx = fnMatch.index + fnMatch[0].length - 1;
    const endIdx = findMatchingBrace(content, openIdx);
    if (endIdx < 0) continue;
    let line = 1;
    for (let i = 0; i < fnMatch.index; i += 1) {
      if (content[i] === '\n') line += 1;
    }
    out.push({ className, startLine: line, openIdx, endIdx });
  }
  return out;
}

/** Every range whose fields belong to a class: class bodies, then factory bodies. */
function findSchemaOwnerRanges(content: string): ClassRange[] {
  return [...findClassRanges(content), ...findSchemaFactoryRanges(content)];
}

function findMatchingBrace(content: string, openIdx: number): number {
  let depth = 0;
  for (let i = openIdx; i < content.length; i += 1) {
    if (content[i] === '{') depth += 1;
    else if (content[i] === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Detect class→subtype registrations in three forms:
 *
 *   1. `CONFIG.<Doc>.dataModels.<subtype> = <ClassName>` (direct assignment)
 *   2. `CONFIG.<Doc>.dataModels = { <subtype>: <ClassName>, … }` (block)
 *   3. `registerSystem({ actorDataModels: { <subtype>: <ClassName>, … }, … })`
 *      and the analogous `itemDataModels`, `activeEffectDataModels`, etc.
 *      — VTTForge's templated entry point uses this form, so without case
 *      (3) the bundled scaffolds register through an unknown surface and
 *      rule 004 falls back to the looser global-union check.
 */
interface ConfigMapping {
  doc: string;
  subtype: string;
  className: string;
}

/**
 * One `<subtype>: <Class>` entry inside a dataModels object literal.
 *
 * The key is bare for a system (`character`) and quoted for a module
 * (`'my-module.vehicle'`), because the module form contains a dot.
 */
const SUBTYPE_ENTRY_RE = /(?:['"]([^'"]+)['"]|(\w+))\s*:\s*(\w+)/g;

/** Map a `registerSystem({ ...DataModels })` key to the document name. */
const REGISTER_SYSTEM_KEYS: ReadonlyArray<{ key: string; doc: string }> = [
  { key: 'actorDataModels', doc: 'Actor' },
  { key: 'itemDataModels', doc: 'Item' },
  { key: 'activeEffectDataModels', doc: 'ActiveEffect' },
  { key: 'journalEntryPageDataModels', doc: 'JournalEntryPage' },
  { key: 'regionBehaviorDataModels', doc: 'RegionBehavior' },
];

function findConfigMappings(content: string): ConfigMapping[] {
  const out: ConfigMapping[] = [];

  // (1) Direct CONFIG.<Doc>.dataModels.<subtype> = <Class>
  const direct = /CONFIG\.(\w+)\.dataModels\.(\w+)\s*=\s*(\w+)/g;
  for (const m of content.matchAll(direct)) {
    out.push({ doc: m[1] ?? '', subtype: m[2] ?? '', className: m[3] ?? '' });
  }

  // (1b) Bracket CONFIG.<Doc>.dataModels['<subtype>'] = <Class>
  //
  // Modules must use this form: Foundry registers their subtypes as
  // `<moduleId>.<type>`, and a dot in the key rules out property access.
  // Without this case module registrations are invisible, every module
  // field falls through to the looser global check, and a genuinely
  // undeclared path can hide behind a same-named one declared elsewhere.
  const bracket = /CONFIG\.(\w+)\.dataModels\[\s*['"]([^'"]+)['"]\s*\]\s*=\s*(\w+)/g;
  for (const m of content.matchAll(bracket)) {
    out.push({ doc: m[1] ?? '', subtype: m[2] ?? '', className: m[3] ?? '' });
  }

  // (2) Block CONFIG.<Doc>.dataModels = { <subtype>: <Class>, … }
  const block = /CONFIG\.(\w+)\.dataModels\s*=\s*\{([\s\S]*?)\}/g;
  for (const m of content.matchAll(block)) {
    const doc = m[1] ?? '';
    const body = m[2] ?? '';
    for (const e of body.matchAll(SUBTYPE_ENTRY_RE)) {
      out.push({ doc, subtype: e[1] ?? e[2] ?? '', className: e[3] ?? '' });
    }
  }

  // (3) registerSystem({ actorDataModels: { ... }, itemDataModels: { ... }, … })
  // Find every `<KeyName>: {` block within the file body, then grab the
  // pairs inside. We use balanced-brace extraction so a nested SchemaField
  // initializer doesn't truncate the body — but `dataModels` blocks
  // typically only contain simple `<subtype>: <ClassName>` entries.
  for (const { key, doc } of REGISTER_SYSTEM_KEYS) {
    const re = new RegExp(String.raw`\b${key}\s*:\s*\{`, 'g');
    for (const m of content.matchAll(re)) {
      if (m.index === undefined) continue;
      const openIdx = m.index + m[0].length - 1;
      let depth = 0;
      let endIdx = -1;
      for (let i = openIdx; i < content.length; i += 1) {
        if (content[i] === '{') depth += 1;
        else if (content[i] === '}') {
          depth -= 1;
          if (depth === 0) {
            endIdx = i;
            break;
          }
        }
      }
      if (endIdx < 0) continue;
      const body = content.slice(openIdx + 1, endIdx);
      for (const pair of body.matchAll(SUBTYPE_ENTRY_RE)) {
        out.push({ doc, subtype: pair[1] ?? pair[2] ?? '', className: pair[3] ?? '' });
      }
    }
  }

  return out;
}

/**
 * Match `<name>: new (f|fields|foundry.data.fields).HTMLField(` or
 * `.FilePathField(`. We capture the field name, the field type, the
 * enclosing class, AND the dot-path through any enclosing SchemaField
 * wrappers — so rule 004 compares against the FULL manifest declaration
 * path (`profile.bio`), not just the leaf segment (`bio`).
 */
const RICH_FIELD_RE = /(\w+)\s*:\s*new\s+(?:[\w.]+\.)?(HTMLField|FilePathField)\s*\(/g;

interface RichFieldUsage {
  fieldName: string;
  type: 'HTMLField' | 'FilePathField';
  line: number;
  enclosingClass: string | undefined;
  /** Dot-path through SchemaField nesting (e.g. `profile.bio`, or just `bio` at top level). */
  schemaPath: string;
}

function findRichFields(content: string, classes: ClassRange[]): RichFieldUsage[] {
  const out: RichFieldUsage[] = [];
  for (const m of content.matchAll(RICH_FIELD_RE)) {
    if (m.index === undefined) continue;
    let line = 1;
    for (let i = 0; i < m.index; i += 1) {
      if (content[i] === '\n') line += 1;
    }
    const fieldName = m[1] ?? '(anonymous)';
    out.push({
      fieldName,
      type: (m[2] as 'HTMLField' | 'FilePathField') ?? 'HTMLField',
      line,
      enclosingClass: findEnclosingClass(classes, m.index),
      schemaPath: buildSchemaPath(content, m.index, fieldName),
    });
  }
  return out;
}

/**
 * Walk backward from a rich-field match looking for enclosing SchemaField
 * wrappers, building the dot-path up to the outermost schema.
 *
 * For `profile: new SchemaField({ bio: new HTMLField() })`, the rich-field
 * match is `bio: new HTMLField(`; walking back, we find the enclosing `{`
 * that's preceded by `profile: new ...SchemaField(`, prepend `profile`, and
 * recurse. Top-level fields (immediate children of `defineSchema()`'s
 * returned object) recurse until the enclosing `{` has no SchemaField
 * ancestor, returning just the field name.
 */
function buildSchemaPath(content: string, idx: number, fieldName: string): string {
  // Find the immediate enclosing `{` by walking backward, tracking balance.
  let depth = 0;
  let openIdx = -1;
  for (let i = idx - 1; i >= 0; i -= 1) {
    const ch = content[i];
    if (ch === '}') depth += 1;
    else if (ch === '{') {
      if (depth === 0) {
        openIdx = i;
        break;
      }
      depth -= 1;
    }
  }
  if (openIdx < 0) return fieldName;

  // Look at the text immediately preceding the enclosing `{` for a
  // `<key>: new <prefix>SchemaField(` pattern. The lookback window is
  // bounded so we don't accidentally cross other constructs.
  const lookbackStart = Math.max(0, openIdx - 200);
  const before = content.slice(lookbackStart, openIdx);
  const m = before.match(/(\w+)\s*:\s*new\s+(?:[\w.]+\.)?SchemaField\s*\(\s*$/);
  if (!m) return fieldName;
  const parentName = m[1] ?? '';
  if (!parentName) return fieldName;
  // The parent's match position relative to content — recurse from there
  // so multi-level nesting (`profile.contact.email`) is captured.
  const parentMatchStart = lookbackStart + (m.index ?? 0);
  const parentPath = buildSchemaPath(content, parentMatchStart, parentName);
  return `${parentPath}.${fieldName}`;
}

interface DeclaredFields {
  /**
   * Keyed `Doc.subtype` → declared htmlFields / filePathFields.
   * Paths are stored AFTER stripping a leading `system.` prefix (Foundry
   * convention puts TypeDataModel-driven manifests under `system.…`) so
   * we can compare against source-side paths that don't include the
   * `system.` root.
   */
  perSubtype: Map<string, { html: Set<string>; filePath: Set<string> }>;
  /**
   * The manifest's own `id`. Modules declare subtypes under a bare key
   * (`vehicle`) but Foundry registers them prefixed (`my-module.vehicle`),
   * which is the form that appears in source. Stripping this prefix is
   * what lets the two sides meet.
   */
  packageId: string | null;
  /** Union across every subtype — used as a fallback when class→subtype lookup fails. */
  globalHtml: Set<string>;
  globalFilePath: Set<string>;
}

/**
 * Foundry's manifest convention puts TypeDataModel-driven field paths
 * under the `system.` root (`system.biography`). Source-side rich-field
 * paths from `buildSchemaPath` don't include that prefix because they
 * start from `defineSchema()`'s returned object. Strip it for matching.
 */
function normalizeDeclaredPath(path: string): string {
  return path.startsWith('system.') ? path.slice('system.'.length) : path;
}

/**
 * Find one subtype's declarations, accounting for the module prefix.
 *
 * A system declares `character` in the manifest and registers `character`
 * in source — the two match directly. A module declares `vehicle` but
 * Foundry registers it as `my-module.vehicle`, and that prefixed form is
 * what appears in source. Comparing the two verbatim reports every
 * correctly declared module field as missing, so fall back to the bare key
 * once the package's own prefix is stripped.
 *
 * Only this package's prefix is stripped. A subtype contributed by some
 * other module is genuinely not ours to have declared.
 */
function lookupSubtype(
  declared: DeclaredFields,
  doc: string,
  subtype: string,
): { html: Set<string>; filePath: Set<string> } | undefined {
  const direct = declared.perSubtype.get(`${doc}.${subtype}`);
  if (direct) return direct;
  const prefix = declared.packageId ? `${declared.packageId}.` : null;
  if (!prefix || !subtype.startsWith(prefix)) return undefined;
  return declared.perSubtype.get(`${doc}.${subtype.slice(prefix.length)}`);
}

/**
 * VTTF-AUDIT-004 — cross-check source HTMLField/FilePathField usages
 * against the manifest's documentTypes declarations.
 *
 * Subtype-aware: if the enclosing class is registered on
 * `CONFIG.<Doc>.dataModels.<subtype>`, the field must be declared in
 * THAT subtype's htmlFields / filePathFields. Otherwise — class
 * unregistered, registration spread across files, dynamic registration —
 * we fall back to the global union check (catches the common "forgot to
 * declare anything" case without false positives on advanced setups).
 */
function rule004(
  filePath: string,
  content: string,
  declared: DeclaredFields,
  classToSubtypes: Map<string, ConfigMapping[]>,
): RuleResult[] {
  const classes = findSchemaOwnerRanges(content);
  const usages = findRichFields(content, classes);
  const out: RuleResult[] = [];
  for (const usage of usages) {
    const declaredBucketName = usage.type === 'HTMLField' ? 'htmlFields' : 'filePathFields';
    const mappings = usage.enclosingClass ? (classToSubtypes.get(usage.enclosingClass) ?? []) : [];
    const sourcePath = usage.schemaPath;

    if (mappings.length > 0) {
      // Strict per-subtype check: every subtype this class is registered
      // under must declare the field's FULL source path. `profile.bio`
      // declared in `Actor.character` doesn't cover an undeclared
      // `profile.bio` in `Actor.npc`.
      const missing = mappings.filter((mapping) => {
        const decl = lookupSubtype(declared, mapping.doc, mapping.subtype);
        const bucket = usage.type === 'HTMLField' ? decl?.html : decl?.filePath;
        return !bucket?.has(sourcePath);
      });
      if (missing.length > 0) {
        const locations = missing.map((mapping) => `${mapping.doc}.${mapping.subtype}`).join(', ');
        out.push({
          ruleId: 'VTTF-AUDIT-004',
          title: `${usage.type} not declared in manifest documentTypes`,
          severity: 'MEDIUM',
          filePath,
          line: usage.line,
          message: `\`${usage.enclosingClass}\` declares \`${sourcePath}\` as ${usage.type}, but documentTypes.${locations}.${declaredBucketName} does not list this path. The Foundry server only sanitises declared paths.`,
          remediation: `Add \`${sourcePath}\` (or \`system.${sourcePath}\`) to documentTypes.${missing[0]?.doc}.${missing[0]?.subtype}.${declaredBucketName} in your manifest.`,
        });
      }
      continue;
    }

    // Fallback: no class→subtype mapping detected (class not registered,
    // registration via an unrecognized API, dynamic registration). Check
    // the global union — still useful, but with looser semantics. Match
    // on FULL source path so `profile.bio` declared doesn't silently
    // shadow an undeclared `journal.bio`.
    const bucket = usage.type === 'HTMLField' ? declared.globalHtml : declared.globalFilePath;
    if (bucket.has(sourcePath)) continue;
    out.push({
      ruleId: 'VTTF-AUDIT-004',
      title: `${usage.type} not declared in manifest documentTypes`,
      severity: 'MEDIUM',
      filePath,
      line: usage.line,
      message: `Schema declares \`${sourcePath}\` as ${usage.type}, but no documentTypes.<Doc>.<subtype>.${declaredBucketName} entry lists this path. The Foundry server only sanitises declared paths.`,
      remediation: `Add \`${sourcePath}\` (or \`system.${sourcePath}\`) to documentTypes.<Doc>.<subtype>.${declaredBucketName} in your manifest.`,
    });
  }
  return out;
}

/**
 * VTTF-AUDIT-007 — manifest's `primaryTokenAttribute` /
 * `secondaryTokenAttribute` must point at a SchemaField with `value` +
 * `max` keys. If not, Foundry's `getBarAttribute` silently degrades to
 * value-only rendering (no bar at all).
 *
 * Cross-check walks the source for every SchemaField declaration paired
 * with its full schema path (`buildSchemaPath`). The manifest path is
 * matched EXACTLY — `primaryTokenAttribute: 'health'` does not accept a
 * nested `attributes.health` SchemaField, and a nested path like
 * `attributes.hp` is resolved by finding the declaration at that exact
 * dot-path. No more "verify manually" branch; either the path resolves
 * or it doesn't.
 */
async function rule007(
  manifestPath: string | null,
  manifestRaw: string | null,
  manifestParsed: Record<string, unknown> | null,
  sourceFiles: string[],
  classToSubtypes: Map<string, ConfigMapping[]>,
): Promise<RuleResult[]> {
  if (!manifestPath || !manifestRaw || !manifestParsed) return [];
  const actorClasses = new Set(
    [...classToSubtypes.entries()]
      .filter(([, mappings]) => mappings.some((m) => m.doc === 'Actor'))
      .map(([className]) => className),
  );

  const out: RuleResult[] = [];
  for (const key of ['primaryTokenAttribute', 'secondaryTokenAttribute'] as const) {
    const value = manifestParsed[key];
    if (typeof value !== 'string' || value.length === 0) continue;
    const matched = await sourceHasValueMaxSchemaAtPath(sourceFiles, value, actorClasses);
    if (!matched) {
      out.push({
        ruleId: 'VTTF-AUDIT-007',
        title: `${key} does not resolve to a {value, max} SchemaField`,
        severity: 'MEDIUM',
        filePath: manifestPath,
        line: lineOfInRaw(manifestRaw, key),
        message: `Manifest ${key} is \`${value}\`, but no TypeDataModel schema in the source declares a SchemaField at this path with both \`value\` and \`max\` keys. Foundry's getBarAttribute degrades silently when the structure doesn't match.`,
        remediation: `Define \`${value}\` as a SchemaField with \`value\` and \`max\` NumberField children in your TypeDataModel schema (matching the manifest path exactly).`,
      });
    }
  }
  return out;
}

function lineOfInRaw(raw: string, key: string): number | undefined {
  const idx = raw.indexOf(`"${key}"`);
  if (idx < 0) return undefined;
  let line = 1;
  for (let i = 0; i < idx; i += 1) {
    if (raw[i] === '\n') line += 1;
  }
  return line;
}

/**
 * Path-aware lookup for the rule-007 cross-check. For every SchemaField
 * declaration in every source file, compute its FULL schema path via
 * `buildSchemaPath`. Match the manifest's `primaryTokenAttribute` (which
 * may be a single key like `health` or a dotted path like `attributes.hp`)
 * against the declaration's path exactly. Only declarations whose schema
 * path equals the manifest value contribute to the value+max check.
 *
 * Why exact path: an unqualified `health: new SchemaField(...)` inside
 * `attributes: new SchemaField({...})` has schema path `attributes.health`.
 * Manifest `primaryTokenAttribute: 'health'` should NOT resolve to that
 * nested declaration — Foundry walks the document path structurally and
 * would look for `health.value` at the top of `system`, not under
 * `attributes`.
 */
async function sourceHasValueMaxSchemaAtPath(
  sourceFiles: string[],
  targetPath: string,
  actorClasses: ReadonlySet<string>,
): Promise<boolean> {
  for (const file of sourceFiles) {
    let content: string;
    try {
      content = await readFile(file, 'utf8');
    } catch {
      continue;
    }
    const classes = findSchemaOwnerRanges(content);
    for (const decl of findAllSchemaFields(content)) {
      if (decl.path !== targetPath) continue;
      // Token bars read `actor.system`, so only a schema registered as an
      // Actor data model can satisfy the manifest. An Item model that
      // happens to declare the same path does not — accepting it would
      // pass the rule on a system whose token bars are in fact broken.
      //
      // This narrowing only applies when the registrations are known.
      // With none found there is no ground truth to narrow by, so every
      // declaration counts — same fallback rule 004 takes when it cannot
      // resolve a class to its subtypes.
      if (actorClasses.size > 0) {
        const owner = classes.find((c) => decl.index > c.openIdx && decl.index < c.endIdx);
        if (!owner || !actorClasses.has(owner.className)) continue;
      }
      const topKeys = extractTopLevelKeys(decl.body);
      if (topKeys.has('value') && topKeys.has('max')) return true;
    }
  }
  return false;
}

/**
 * Find every `<name>: new ...SchemaField({...})` declaration in `content`,
 * returning each with its FULL dot-path through enclosing SchemaField
 * wrappers and the raw object-literal body. Used by rule 007 to look up
 * a SchemaField at an exact manifest path.
 */
interface SchemaFieldDecl {
  path: string;
  body: string;
  /** Offset of the declaration, used to find its enclosing class. */
  index: number;
}

function findAllSchemaFields(content: string): SchemaFieldDecl[] {
  const out: SchemaFieldDecl[] = [];
  const startRe = /(\w+)\s*:\s*new\s+(?:[\w.]+\.)?SchemaField\s*\(\s*\{/g;
  for (const m of content.matchAll(startRe)) {
    if (m.index === undefined) continue;
    const fieldName = m[1] ?? '';
    const openIdx = m.index + m[0].length - 1;
    let depth = 0;
    let endIdx = -1;
    for (let i = openIdx; i < content.length; i += 1) {
      if (content[i] === '{') depth += 1;
      else if (content[i] === '}') {
        depth -= 1;
        if (depth === 0) {
          endIdx = i;
          break;
        }
      }
    }
    if (endIdx < 0) continue;
    out.push({
      path: buildSchemaPath(content, m.index, fieldName),
      body: content.slice(openIdx + 1, endIdx),
      index: m.index,
    });
  }
  return out;
}

/**
 * Extract identifier keys declared at depth 0 of an object-literal body.
 *
 * The naive `value:`/`max:` regex check matches nested constructor options
 * too — `value: new NumberField({ max: 100 })` looked to a flat regex like
 * both keys were SchemaField siblings. Walking the body byte-by-byte with
 * depth tracking + string-boundary handling correctly distinguishes
 * top-level keys from nested ones.
 */
function extractTopLevelKeys(body: string): Set<string> {
  const keys = new Set<string>();
  let depth = 0;
  let inString: '"' | "'" | '`' | null = null;
  let escaped = false;
  let pos = 0;
  const idStart = /[a-zA-Z_$]/;
  const idCont = /[\w$]/;
  const ws = /\s/;
  while (pos < body.length) {
    const ch = body[pos];
    if (ch === undefined) break;
    if (escaped) {
      escaped = false;
      pos += 1;
      continue;
    }
    if (inString) {
      if (ch === '\\') escaped = true;
      else if (ch === inString) inString = null;
      pos += 1;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inString = ch;
      pos += 1;
      continue;
    }
    if (ch === '{' || ch === '(' || ch === '[') {
      depth += 1;
      pos += 1;
      continue;
    }
    if (ch === '}' || ch === ')' || ch === ']') {
      depth -= 1;
      pos += 1;
      continue;
    }
    if (depth === 0 && idStart.test(ch)) {
      let end = pos;
      while (end < body.length && idCont.test(body[end] ?? '')) end += 1;
      const name = body.slice(pos, end);
      let after = end;
      while (after < body.length && ws.test(body[after] ?? '')) after += 1;
      if (body[after] === ':') {
        keys.add(name);
        pos = after + 1;
        continue;
      }
      pos = end;
      continue;
    }
    pos += 1;
  }
  return keys;
}

/**
 * Load every manifest at the project root, then return:
 *   - declared.perSubtype: per `Doc.subtype` htmlFields / filePathFields sets
 *   - declared.globalHtml / globalFilePath: union across all subtypes
 *   - manifest path/raw/parsed for the manifest we found first
 *
 * Used by rules 004 and 007. The per-subtype map lets rule 004 do a strict
 * cross-check when it knows which subtype a source class is registered to;
 * the global union is the fallback when no class→subtype mapping is found.
 */
async function collectDeclaredRichFields(cwd: string): Promise<{
  declared: DeclaredFields;
  manifestPath: string | null;
  manifestRaw: string | null;
  manifestParsed: Record<string, unknown> | null;
}> {
  const perSubtype = new Map<string, { html: Set<string>; filePath: Set<string> }>();
  const globalHtml = new Set<string>();
  const globalFilePath = new Set<string>();
  let manifestPath: string | null = null;
  let manifestRaw: string | null = null;
  let manifestParsed: Record<string, unknown> | null = null;
  let packageId: string | null = null;

  for (const file of ['system.json', 'module.json']) {
    const p = join(cwd, file);
    if (!existsSync(p)) continue;
    let raw: string;
    try {
      raw = await readFile(p, 'utf8');
    } catch {
      continue;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue;
    if (!manifestPath) {
      manifestPath = p;
      manifestRaw = raw;
      manifestParsed = parsed as Record<string, unknown>;
      const id = (parsed as Record<string, unknown>).id;
      packageId = typeof id === 'string' && id.length > 0 ? id : null;
    }
    const docTypes = (parsed as Record<string, unknown>).documentTypes;
    if (!docTypes || typeof docTypes !== 'object' || Array.isArray(docTypes)) continue;
    for (const [docName, docType] of Object.entries(docTypes as Record<string, unknown>)) {
      if (!docType || typeof docType !== 'object' || Array.isArray(docType)) continue;
      for (const [subName, subtype] of Object.entries(docType as Record<string, unknown>)) {
        if (!subtype || typeof subtype !== 'object' || Array.isArray(subtype)) continue;
        const sub = subtype as Record<string, unknown>;
        const key = `${docName}.${subName}`;
        const entry = perSubtype.get(key) ?? {
          html: new Set<string>(),
          filePath: new Set<string>(),
        };
        if (Array.isArray(sub.htmlFields)) {
          for (const e of sub.htmlFields) {
            if (typeof e === 'string') {
              const normalized = normalizeDeclaredPath(e);
              entry.html.add(normalized);
              globalHtml.add(normalized);
            }
          }
        }
        // `filePathFields` is an object, not an array: its KEYS are the
        // field paths and each value lists the file categories allowed
        // there. `htmlFields` above really is a flat array — the two
        // differ, and reading both as arrays drops every correctly
        // declared path.
        for (const declaredPath of declaredFilePathKeys(sub.filePathFields)) {
          const normalized = normalizeDeclaredPath(declaredPath);
          entry.filePath.add(normalized);
          globalFilePath.add(normalized);
        }
        perSubtype.set(key, entry);
      }
    }
  }
  return {
    declared: { perSubtype, packageId, globalHtml, globalFilePath },
    manifestPath,
    manifestRaw,
    manifestParsed,
  };
}

/**
 * Read the declared file-path keys off one subtype's `filePathFields`.
 *
 * The manifest shape is an object keyed by field path, whose values name
 * the permitted file categories. Older hand-written manifests sometimes
 * carry a bare array instead; that shape does not validate, but reading it
 * costs nothing and avoids reporting a field as undeclared when the author
 * plainly declared it.
 */
function declaredFilePathKeys(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((e): e is string => typeof e === 'string');
  }
  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>);
  }
  return [];
}

/**
 * Aggregate every `CONFIG.<Doc>.dataModels.<subtype> = <ClassName>`
 * mapping discovered across all source files, keyed by class name.
 * Rule 004 reads this to determine which subtype each rich-field's
 * enclosing class is registered under.
 */
function buildClassToSubtypes(fileContents: Iterable<string>): Map<string, ConfigMapping[]> {
  const map = new Map<string, ConfigMapping[]>();
  for (const content of fileContents) {
    for (const mapping of findConfigMappings(content)) {
      if (!mapping.className) continue;
      const existing = map.get(mapping.className) ?? [];
      existing.push(mapping);
      map.set(mapping.className, existing);
    }
  }
  return map;
}

/** Strip a dot-path to its final segment (e.g. `system.biography` → `biography`). */
function lastSegment(path: string): string {
  const idx = path.lastIndexOf('.');
  return idx < 0 ? path : path.slice(idx + 1);
}

/** Entry point: gather everything once, then dispatch to the per-file rules. */
export async function runSourceRules(cwd: string): Promise<RuleResult[]> {
  if (!existsSync(cwd)) return [];
  const info = await stat(cwd);
  if (!info.isDirectory()) return [];

  const { declared, manifestPath, manifestRaw, manifestParsed } =
    await collectDeclaredRichFields(cwd);
  const sourceFiles: string[] = [];
  for await (const file of walkSourceFiles(cwd)) {
    sourceFiles.push(file);
  }

  // Read every source file once so rule 004's class→subtype map can scan
  // across the whole project (CONFIG mappings frequently live in `main.ts`
  // separate from the data-model files).
  const contents = new Map<string, string>();
  for (const file of sourceFiles) {
    try {
      contents.set(file, await readFile(file, 'utf8'));
    } catch {
      // skip unreadable files
    }
  }
  const classToSubtypes = buildClassToSubtypes(contents.values());

  const results: RuleResult[] = [];
  for (const [file, content] of contents) {
    results.push(...rule005(file, content));
    results.push(...rule006(file, content));
    results.push(...rule004(file, content, declared, classToSubtypes));
  }
  results.push(
    ...(await rule007(manifestPath, manifestRaw, manifestParsed, sourceFiles, classToSubtypes)),
  );
  return results;
}

// Internal helpers exported so tests can drive the file walker without
// pulling in the orchestrator's manifest dependency.
export const _internal = {
  walkSourceFiles,
  isSourceFile,
  lastSegment,
  EXCLUDED_DIRS,
};
