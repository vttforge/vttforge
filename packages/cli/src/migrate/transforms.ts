/**
 * The rewrites `vttforge migrate` applies to a v13 source file.
 *
 * Each transform is a pure function over the file's text. It returns the new
 * text, one `Change` per edit it made, and one `Note` per thing it saw and
 * would not touch: a rewrite that needs a decision (which page a `game.template`
 * read should become) is reported, not guessed.
 *
 * Text-based, like the audit rules they mirror (`VTTF-AUDIT-011` to `016`).
 * The patterns are short and mechanical, and a syntax tree would not make
 * `'-=key'` easier to find. Comments are left alone: every match has to
 * start in code. A match inside a string literal is still rewritten, which
 * is what the preview is for.
 */

import { MASK, maskComments } from '../audit/mask.js';
import { REMOVED_UTILS } from '../audit/v14-rules.js';

export interface Change {
  /** 1-based line of the edit, in the original text. */
  line: number;
  /** What was there. */
  before: string;
  /** What is there now. */
  after: string;
  /** Which transform made it. */
  rule: string;
}

export interface Note {
  line: number;
  rule: string;
  /** What was seen, and what the reader has to decide. */
  message: string;
}

export interface TransformResult {
  output: string;
  changes: Change[];
  notes: Note[];
}

export type Transform = (source: string) => TransformResult;

function lineAt(source: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < source.length; i += 1) {
    if (source[i] === '\n') line += 1;
  }
  return line;
}

/** The whole line an index sits on, trimmed, for the report. */
function lineText(source: string, index: number): string {
  const start = source.lastIndexOf('\n', index - 1) + 1;
  const end = source.indexOf('\n', index);
  return source.slice(start, end === -1 ? source.length : end).trim();
}

/**
 * Replace every match, recording one change per match against the original
 * text. The replacement may be a string or a function, like `String#replace`.
 */
function rewrite(
  source: string,
  pattern: RegExp,
  replacement: string | ((...groups: string[]) => string),
  rule: string,
): TransformResult {
  const changes: Change[] = [];
  const code = maskComments(source);
  const output = source.replace(pattern, (match: string, ...rest: unknown[]) => {
    const offset = rest.find((r): r is number => typeof r === 'number') ?? 0;
    if (code[offset] === MASK) return match;
    const groups = rest.filter((r): r is string => typeof r === 'string');
    const after = typeof replacement === 'string' ? replacement : replacement(match, ...groups);
    if (after !== match) {
      changes.push({ line: lineAt(source, offset), before: match, after, rule });
    }
    return after;
  });
  return { output, changes, notes: [] };
}

function merge(...results: TransformResult[]): TransformResult {
  const last = results.at(-1);
  return {
    output: last?.output ?? '',
    changes: results.flatMap((r) => r.changes),
    notes: results.flatMap((r) => r.notes),
  };
}

/** Run transforms in sequence, each on the previous one's output. */
function pipe(source: string, transforms: readonly Transform[]): TransformResult {
  const results: TransformResult[] = [];
  let current = source;
  for (const transform of transforms) {
    const result = transform(current);
    results.push(result);
    current = result.output;
  }
  return merge(...results);
}

/**
 * Bare v12 utility globals → `foundry.utils.*`; `Math.clamped` → `Math.clamp`.
 *
 * A name the file declares or imports itself is left alone, the same way
 * `VTTF-AUDIT-011` leaves it alone. `game.template` is reported, not
 * rewritten: whether it becomes `game.model` or a `documentTypes` read depends
 * on what was read from it.
 */
export const removedGlobals: Transform = (source) => {
  const own = new Set(
    REMOVED_UTILS.filter((name) =>
      new RegExp(
        `(?:function\\s+${name}\\b|(?:const|let|var)\\s+${name}\\b|import[^;]*\\b${name}\\b|\\b${name}\\s*\\([^)]*\\)\\s*\\{)`,
      ).test(source),
    ),
  );
  const names = REMOVED_UTILS.filter((name) => !own.has(name));
  const utils = names.length
    ? rewrite(
        source,
        new RegExp(`(?<![\\w$.])(${names.join('|')})\\s*\\(`, 'g'),
        (_m, name) => `foundry.utils.${name}(`,
        'removed-globals',
      )
    : { output: source, changes: [], notes: [] };
  const clamped = rewrite(utils.output, /\bMath\.clamped\s*\(/g, 'Math.clamp(', 'removed-globals');
  const notes: Note[] = [];
  const code = maskComments(clamped.output);
  for (const match of clamped.output.matchAll(/\bgame\.template\b/g)) {
    if (code[match.index ?? 0] === MASK) continue;
    notes.push({
      line: lineAt(clamped.output, match.index ?? 0),
      rule: 'removed-globals',
      message:
        "`game.template` is gone. Read type defaults from `game.model`, or the type list from the package's `documentTypes`.",
    });
  }
  return { ...merge(utils, clamped), notes };
};

/**
 * `'-=key': null` → `key: _del`; `'==key': value` → `key: _replace(value)`;
 * `performDeletions` → `applyOperators`; `objectsEqual` → `equals`.
 */
export const dataOperators: Transform = (source) => {
  const deletions = rewrite(
    source,
    /(['"])((?:[\w$]+\.)*)-=([\w$.]+)\1\s*:\s*null\b/g,
    (_m, quote, prefix, key) => `${quote}${prefix}${key}${quote}: _del`,
    'data-operators',
  );
  // `"==key": <value>` wraps a value of any shape, so the value is scanned to
  // its end rather than matched: up to the comma or brace that closes it, with
  // brackets, braces, parentheses and strings balanced along the way.
  const replacements = wrapReplacementValues(deletions.output);
  const flags = rewrite(
    replacements.output,
    /\bperformDeletions\s*:/g,
    'applyOperators:',
    'data-operators',
  );
  const equals = rewrite(
    flags.output,
    /\bfoundry\.utils\.objectsEqual\s*\(/g,
    'foundry.utils.equals(',
    'data-operators',
  );
  return merge(deletions, replacements, flags, equals);
};

function wrapReplacementValues(source: string): TransformResult {
  const changes: Change[] = [];
  const pattern = /(['"])((?:[\w$]+\.)*)==([\w$.]+)\1\s*:\s*/g;
  const code = maskComments(source);
  let out = '';
  let cursor = 0;
  for (const match of source.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (code[start] === MASK) continue;
    const valueStart = start + match[0].length;
    const valueEnd = scanValueEnd(source, valueStart);
    if (valueEnd === -1) continue;
    const value = source.slice(valueStart, valueEnd).trimEnd();
    const [, quote = '"', prefix = '', key = ''] = match;
    const after = `${quote}${prefix}${key}${quote}: _replace(${value})`;
    out += source.slice(cursor, start) + after;
    cursor = valueStart + value.length;
    changes.push({
      line: lineAt(source, start),
      before: source.slice(start, cursor),
      after,
      rule: 'data-operators',
    });
  }
  out += source.slice(cursor);
  return { output: out, changes, notes: [] };
}

/** Index just past a value that starts at `from`: the next `,` or `}` at depth zero. */
function scanValueEnd(source: string, from: number): number {
  let depth = 0;
  let quote: string | null = null;
  for (let i = from; i < source.length; i += 1) {
    const ch = source[i] ?? '';
    if (quote) {
      if (ch === '\\') i += 1;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') quote = ch;
    else if (ch === '{' || ch === '[' || ch === '(') depth += 1;
    else if (ch === '}' || ch === ']' || ch === ')') {
      if (depth === 0) return i;
      depth -= 1;
    } else if (ch === ',' && depth === 0) return i;
  }
  return -1;
}

const ROLL_MODE_VALUES: Record<string, string> = {
  publicroll: 'public',
  gmroll: 'gm',
  blindroll: 'blind',
  selfroll: 'self',
};

const ROLL_MODE_CONSTANTS: Record<string, string> = {
  PUBLIC: 'public',
  PRIVATE: 'gm',
  BLIND: 'blind',
  SELF: 'self',
};

/**
 * `rollMode` → `messageMode`, with the value mapped when it is a literal.
 *
 * `"roll"` meant "whatever the user's chat dropdown says", which is what an
 * absent `messageMode` means now, so it becomes `undefined`. A value that is
 * an expression is left for the reader, with a note.
 */
export const rollMode: Transform = (source) => {
  const notes: Note[] = [];
  const option = rewrite(
    source,
    /\brollMode\s*:\s*(['"])(publicroll|gmroll|blindroll|selfroll|roll)\1/g,
    (_m, quote, value) =>
      value === 'roll'
        ? 'messageMode: undefined'
        : `messageMode: ${quote}${ROLL_MODE_VALUES[value]}${quote}`,
    'roll-mode',
  );
  const key = rewrite(
    option.output,
    /\brollMode\s*:/g,
    (m) => m.replace('rollMode', 'messageMode'),
    'roll-mode',
  );
  for (const change of key.changes) {
    notes.push({
      line: change.line,
      rule: 'roll-mode',
      message:
        'The value is an expression. If it can be a v13 mode name, wrap it: `Roll._mapLegacyRollMode(value)`.',
    });
  }
  const setting = rewrite(
    key.output,
    /(['"])core\1\s*,\s*(['"])rollMode\2/g,
    (_m, q1, q2) => `${q1}core${q1}, ${q2}messageMode${q2}`,
    'roll-mode',
  );
  const modes = rewrite(
    setting.output,
    /\bCONFIG\.Dice\.rollModes\b/g,
    'CONFIG.ChatMessage.modes',
    'roll-mode',
  );
  const constants = rewrite(
    modes.output,
    /\bCONST\.DICE_ROLL_MODES\.(PUBLIC|PRIVATE|BLIND|SELF)\b/g,
    (_m, name) => `"${ROLL_MODE_CONSTANTS[name]}"`,
    'roll-mode',
  );
  return { ...merge(option, key, setting, modes, constants), notes };
};

/**
 * Context-menu entries and header controls: `name` → `label`, `condition` →
 * `visible`, `callback` → `onClick`. Only inside an object literal that has a
 * `callback` and an `icon` or `condition`, so an unrelated `name:` elsewhere
 * is not renamed. The callback's parameters change too, from `(li)` to
 * `(event, target)`, and that is noted rather than rewritten.
 */
export const contextMenuKeys: Transform = (source) => {
  const changes: Change[] = [];
  const notes: Note[] = [];
  let output = source;
  // Walk object literals from the innermost out: find `{`, balance to its `}`,
  // and rewrite the keys of that literal when it looks like a menu entry.
  const literals = objectLiterals(source);
  for (const { start, end } of literals.reverse()) {
    const body = output.slice(start, end);
    if (!/\bcallback\s*:/.test(body) || !/\b(?:icon|condition)\s*:/.test(body)) continue;
    const bodyCode = maskComments(body);
    const KEYS: Record<string, string> = {
      name: 'label',
      condition: 'visible',
      callback: 'onClick',
    };
    // One pass, so the offsets checked against the mask are the body's own.
    const renamed = body.replace(
      /(^|[{,\s])(name|condition|callback)(\s*:)/g,
      (m, lead: string, key: string, colon: string, offset: number) =>
        bodyCode[offset + lead.length] === MASK ? m : `${lead}${KEYS[key]}${colon}`,
    );
    if (renamed === body) continue;
    changes.push({
      line: lineAt(source, start),
      before: lineText(source, start),
      after: 'label / visible / onClick keys',
      rule: 'context-menu-keys',
    });
    notes.push({
      line: lineAt(source, start),
      rule: 'context-menu-keys',
      message:
        '`onClick` receives `(event, target)` where `callback` received the element. Check the parameter list.',
    });
    output = output.slice(0, start) + renamed + output.slice(end);
  }
  return { output, changes, notes };
};

/** Every `{ ... }` span in the text, outermost first, strings and comments skipped. */
function objectLiterals(source: string): Array<{ start: number; end: number }> {
  const spans: Array<{ start: number; end: number }> = [];
  const stack: number[] = [];
  let quote: string | null = null;
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i] ?? '';
    const next = source[i + 1] ?? '';
    if (quote) {
      if (ch === '\\') i += 1;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '/' && next === '/') {
      i = source.indexOf('\n', i);
      if (i === -1) break;
      continue;
    }
    if (ch === '/' && next === '*') {
      const close = source.indexOf('*/', i + 2);
      i = close === -1 ? source.length : close + 1;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') quote = ch;
    else if (ch === '{') stack.push(i);
    else if (ch === '}') {
      const start = stack.pop();
      if (start !== undefined) spans.push({ start, end: i + 1 });
    }
  }
  return spans.sort((a, b) => a.start - b.start);
}

/**
 * `legacyTransferral` is gone: the assignment, and the `activeEffect`
 * option `registerSystem` used to take for it.
 */
export const legacyTransferral: Transform = (source) => {
  const statement = rewrite(
    source,
    /^[ \t]*CONFIG\.ActiveEffect\.legacyTransferral\s*=[^\n]*\n?/gm,
    '',
    'legacy-transferral',
  );
  const option = rewrite(
    statement.output,
    /^[ \t]*activeEffect\s*:\s*\{\s*legacyTransferral\s*:\s*(?:true|false)\s*,?\s*\}\s*,?[ \t]*\n?/gm,
    '',
    'legacy-transferral',
  );
  const key = rewrite(
    option.output,
    /^[ \t]*legacyTransferral\s*:\s*(?:true|false)\s*,?[ \t]*\n?/gm,
    '',
    'legacy-transferral',
  );
  return merge(statement, option, key);
};

/** v14 registers no core Actor or Item sheet, so there is nothing to unregister. */
export const unregisterCoreSheets: Transform = (source) =>
  rewrite(
    source,
    /^[ \t]*(?:foundry\.documents\.collections\.)?(?:Actors|Items)\.unregisterSheet\(\s*['"]core['"][^\n]*\n?/gm,
    '',
    'unregister-core-sheets',
  );

/**
 * `CONFIG.statusEffects = list;` → add each entry by id. The setter empties
 * the collection first, which wipes what other packages added.
 */
export const statusEffectsAssignment: Transform = (source) => {
  const changes: Change[] = [];
  let output = '';
  let cursor = 0;
  const pattern = /\bCONFIG\.statusEffects\s*=(?!=)\s*/g;
  const code = maskComments(source);
  for (const match of source.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (code[start] === MASK) continue;
    const valueStart = start + match[0].length;
    const end = scanStatementEnd(source, valueStart);
    if (end === -1) continue;
    const value = source.slice(valueStart, end).trim();
    const after = `for (const effect of ${value}) CONFIG.statusEffects[effect.id] = effect;`;
    output += source.slice(cursor, start) + after;
    cursor = end + 1;
    changes.push({
      line: lineAt(source, start),
      before: source.slice(start, cursor).trim(),
      after,
      rule: 'status-effects',
    });
  }
  output += source.slice(cursor);
  return { output, changes, notes: [] };
};

/** Index of the `;` that ends a statement starting at `from`, brackets balanced. */
function scanStatementEnd(source: string, from: number): number {
  let depth = 0;
  let quote: string | null = null;
  for (let i = from; i < source.length; i += 1) {
    const ch = source[i] ?? '';
    if (quote) {
      if (ch === '\\') i += 1;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') quote = ch;
    else if (ch === '{' || ch === '[' || ch === '(') depth += 1;
    else if (ch === '}' || ch === ']' || ch === ')') depth -= 1;
    else if (ch === ';' && depth === 0) return i;
  }
  return -1;
}

const EFFECT_MODES: Record<string, string> = {
  CUSTOM: 'custom',
  MULTIPLY: 'multiply',
  ADD: 'add',
  DOWNGRADE: 'downgrade',
  UPGRADE: 'upgrade',
  OVERRIDE: 'override',
};

/**
 * `mode: CONST.ACTIVE_EFFECT_MODES.ADD` → `type: "add"`. A root-level
 * `changes` array on an effect now lives under `system.changes`; that move
 * depends on where the data is built, so it is noted.
 */
export const activeEffectModes: Transform = (source) => {
  const typed = rewrite(
    source,
    /\bmode\s*:\s*CONST\.ACTIVE_EFFECT_MODES\.(CUSTOM|MULTIPLY|ADD|DOWNGRADE|UPGRADE|OVERRIDE)\b/g,
    (_m, name) => `type: "${EFFECT_MODES[name]}"`,
    'active-effect-modes',
  );
  const bare = rewrite(
    typed.output,
    /\bCONST\.ACTIVE_EFFECT_MODES\.(CUSTOM|MULTIPLY|ADD|DOWNGRADE|UPGRADE|OVERRIDE)\b/g,
    (_m, name) => `"${EFFECT_MODES[name]}"`,
    'active-effect-modes',
  );
  const notes: Note[] = typed.changes.map((c) => ({
    line: c.line,
    rule: 'active-effect-modes',
    message: 'The change now belongs under `system.changes`, not a root-level `changes` array.',
  }));
  return { ...merge(typed, bare), notes };
};

/** The transforms, in the order they run. */
const SOURCE_TRANSFORMS: ReadonlyArray<readonly [string, Transform]> = [
  ['removed-globals', removedGlobals],
  ['data-operators', dataOperators],
  ['roll-mode', rollMode],
  ['context-menu-keys', contextMenuKeys],
  ['legacy-transferral', legacyTransferral],
  ['unregister-core-sheets', unregisterCoreSheets],
  ['status-effects', statusEffectsAssignment],
  ['active-effect-modes', activeEffectModes],
];

export function transformSource(source: string): TransformResult {
  return pipe(
    source,
    SOURCE_TRANSFORMS.map(([, t]) => t),
  );
}

/**
 * The manifest: `type` declared, `compatibility` raised to 14 where it is
 * lower. Returns `null` when nothing needed to change.
 */
export function transformManifest(
  raw: string,
  kind: 'system' | 'module',
): { output: string; changes: Change[]; notes: Note[] } | null {
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const changes: Change[] = [];
  const notes: Note[] = [];
  if (parsed.type !== kind) {
    parsed.type = kind;
    changes.push({ line: 1, before: '(no "type")', after: `"type": "${kind}"`, rule: 'manifest' });
  }
  const compatibility = (parsed.compatibility ?? {}) as Record<string, unknown>;
  for (const field of ['minimum', 'verified'] as const) {
    const current = compatibility[field];
    const major = Number.parseInt(String(current ?? '0'), 10);
    if (!Number.isFinite(major) || major < 14) {
      compatibility[field] = '14';
      changes.push({
        line: 1,
        before: `compatibility.${field}: ${JSON.stringify(current ?? null)}`,
        after: `compatibility.${field}: "14"`,
        rule: 'manifest',
      });
    }
  }
  const maximum = compatibility.maximum;
  if (maximum !== undefined && Number.parseInt(String(maximum), 10) < 14) {
    notes.push({
      line: 1,
      rule: 'manifest',
      message: `compatibility.maximum is ${JSON.stringify(maximum)}, which keeps the package off v14. Raise it or remove it.`,
    });
  }
  if ('gridDistance' in parsed || 'gridUnits' in parsed) {
    notes.push({
      line: 1,
      rule: 'manifest',
      message:
        'gridDistance / gridUnits are ignored on v14. Move them into `"grid": { "type", "distance", "units", "diagonals" }`.',
    });
  }
  parsed.compatibility = compatibility;
  if (changes.length === 0) return notes.length ? { output: raw, changes, notes } : null;
  // Keep `type` next to `id`, where the v14 manifests put it.
  const ordered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (key === 'type') continue;
    ordered[key] = value;
    if (key === 'id') ordered.type = parsed.type;
  }
  if (!('type' in ordered)) ordered.type = parsed.type;
  return { output: `${JSON.stringify(ordered, null, 2)}\n`, changes, notes };
}
