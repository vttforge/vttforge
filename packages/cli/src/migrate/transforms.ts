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

import { bareUsePattern, definesName, LEGACY_GLOBALS } from '../audit/legacy-globals.js';
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
 * Bare v13 global aliases → their `foundry.*` path: `renderTemplate(` →
 * `foundry.applications.handlebars.renderTemplate(`, `extends ActorSheet` →
 * `extends foundry.appv1.sheets.ActorSheet`. Same object, no removal date.
 * A name the file declares or imports, an object key, a property, and a
 * word inside a string or comment are left alone.
 */
export const namespacedGlobals: Transform = (source) => {
  const changes: Change[] = [];
  const code = maskComments(source, { strings: true });
  const edits: Array<{ start: number; end: number; text: string; name: string }> = [];
  for (const [name, path] of Object.entries(LEGACY_GLOBALS)) {
    if (definesName(code, name)) continue;
    for (const match of code.matchAll(bareUsePattern(name))) {
      const start = match.index ?? 0;
      edits.push({ start, end: start + name.length, text: path, name });
    }
  }
  let output = source;
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    output = output.slice(0, edit.start) + edit.text + output.slice(edit.end);
  }
  for (const edit of edits.sort((a, b) => a.start - b.start)) {
    changes.push({
      line: lineAt(source, edit.start),
      before: edit.name,
      after: edit.text,
      rule: 'namespaced-globals',
    });
  }
  return { output, changes, notes: [] };
};

/**
 * `'-=key': null` → `key: _del`; `'==key': value` → `key: _replace(value)`;
 * `performDeletions` → `applyOperators`; `objectsEqual` → `equals`.
 *
 * The key may be a template literal with `${...}` segments in the prefix,
 * which is how a flag deletion is usually written: `` [`flags.${id}.-=old`] ``.
 */
export const dataOperators: Transform = (source) => {
  const deletions = rewrite(
    source,
    /(['"`])((?:[\w$]+\.|\$\{[^}]*\}\.)*)-=([\w$.]+)\1(\]?)\s*:\s*null\b/g,
    (_m, quote, prefix, key, bracket) => `${quote}${prefix}${key}${quote}${bracket}: _del`,
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
  const pattern = /(['"`])((?:[\w$]+\.|\$\{[^}]*\}\.)*)==([\w$.]+)\1(\]?)\s*:\s*/g;
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
    const [, quote = '"', prefix = '', key = '', bracket = ''] = match;
    const after = `${quote}${prefix}${key}${quote}${bracket}: _replace(${value})`;
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
 * an expression is wrapped in `Roll._mapLegacyRollMode(...)`, which maps a
 * v13 name and passes a v14 key or `undefined` through unchanged, so the
 * wrap is safe whatever the expression yields.
 */
export const rollMode: Transform = (source) => {
  const option = rewrite(
    source,
    /\brollMode\s*:\s*(['"])(publicroll|gmroll|blindroll|selfroll|roll)\1/g,
    (_m, quote, value) =>
      value === 'roll'
        ? 'messageMode: undefined'
        : `messageMode: ${quote}${ROLL_MODE_VALUES[value]}${quote}`,
    'roll-mode',
  );
  const expressions = wrapRollModeExpressions(option.output);
  const setting = rewrite(
    expressions.output,
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
  return merge(option, expressions, setting, modes, constants);
};

/** `rollMode: <expr>` → `messageMode: Roll._mapLegacyRollMode(<expr>)`. */
function wrapRollModeExpressions(source: string): TransformResult {
  const changes: Change[] = [];
  const pattern = /\brollMode\s*:\s*/g;
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
    const after = `messageMode: Roll._mapLegacyRollMode(${value})`;
    out += source.slice(cursor, start) + after;
    cursor = valueStart + value.length;
    changes.push({
      line: lineAt(source, start),
      before: source.slice(start, cursor),
      after,
      rule: 'roll-mode',
    });
  }
  out += source.slice(cursor);
  return { output: out, changes, notes: [] };
}

/**
 * Hooks that changed shape: noted, not rewritten. `renderChatMessage` is
 * removed in v15 and its replacement hands an element where it handed a
 * jQuery object, so the handler body is the reader's to change.
 */
export const hookNotes: Transform = (source) => {
  const notes: Note[] = [];
  const code = maskComments(source);
  for (const match of source.matchAll(/Hooks\.(?:on|once)\(\s*['"]renderChatMessage['"]/g)) {
    if (code[match.index ?? 0] === MASK) continue;
    notes.push({
      line: lineAt(source, match.index ?? 0),
      rule: 'hooks',
      message:
        '`renderChatMessage` is removed in v15. Listen to `renderChatMessageHTML(message, html, context)`; `html` is the element, so `html.find(x)` becomes `html.querySelector(x)`.',
    });
  }
  return { output: source, changes: [], notes };
};

/**
 * Context-menu entries and header controls: `name` → `label`, `condition` →
 * `visible`, `callback` → `onClick`.
 *
 * Only an object literal whose own keys include `callback` and `name` or
 * `condition` is an entry. A Dialog button has `icon`, `label` and
 * `callback`, and keeps `callback` on v14, so `icon` is not a signal; and
 * only the literal's own keys count, so a class body or a `buttons` bag that
 * happens to contain an entry is not itself treated as one. The callback's
 * parameters change too, from `(li)` to `(event, target)`, and that is noted
 * rather than rewritten.
 */
export const contextMenuKeys: Transform = (source) => {
  const changes: Change[] = [];
  const notes: Note[] = [];
  const RENAME: Record<string, string> = {
    name: 'label',
    condition: 'visible',
    callback: 'onClick',
  };
  // Innermost first, so an edit never moves the offsets of a literal still
  // to be visited: an inner literal sits entirely inside its outer one, and
  // editing it changes the outer one's end, never its start.
  const edits: Array<{ start: number; end: number; text: string }> = [];
  for (const { start, end } of objectLiterals(source).sort((a, b) => b.start - a.start)) {
    const keys = ownKeys(source, start, end);
    const names = new Set(keys.map((k) => k.name));
    if (!names.has('callback') || !(names.has('name') || names.has('condition'))) continue;
    for (const key of keys) {
      const to = RENAME[key.name];
      if (to !== undefined)
        edits.push({ start: key.offset, end: key.offset + key.name.length, text: to });
    }
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
  }
  let output = source;
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    output = output.slice(0, edit.start) + edit.text + output.slice(edit.end);
  }
  return { output, changes, notes };
};

/**
 * The keys an object literal declares itself, with the offset of each name.
 *
 * Walks the span between the braces at depth one: a key is an identifier
 * followed by `:` where a property may start, which is right after the
 * opening brace or after a comma at that depth. Nested literals, arrays,
 * calls, strings and comments are stepped over.
 */
function ownKeys(
  source: string,
  start: number,
  end: number,
): Array<{ name: string; offset: number }> {
  const keys: Array<{ name: string; offset: number }> = [];
  let depth = 0;
  let quote: string | null = null;
  let expectKey = true;
  for (let i = start; i < end; i += 1) {
    const ch = source[i] ?? '';
    const next = source[i + 1] ?? '';
    if (quote) {
      if (ch === '\\') i += 1;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '/' && next === '/') {
      const nl = source.indexOf('\n', i);
      i = nl === -1 ? end : nl;
      continue;
    }
    if (ch === '/' && next === '*') {
      const close = source.indexOf('*/', i + 2);
      i = close === -1 ? end : close + 1;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      expectKey = false;
      continue;
    }
    if (ch === '{' || ch === '[' || ch === '(') {
      depth += 1;
      expectKey = depth === 1 && ch === '{';
      continue;
    }
    if (ch === '}' || ch === ']' || ch === ')') {
      depth -= 1;
      expectKey = false;
      continue;
    }
    if (depth !== 1) continue;
    if (ch === ',') {
      expectKey = true;
      continue;
    }
    if (/\s/.test(ch)) continue;
    if (expectKey && /[A-Za-z_$]/.test(ch)) {
      let j = i;
      while (j < end && /[\w$]/.test(source[j] ?? '')) j += 1;
      let k = j;
      while (k < end && /\s/.test(source[k] ?? '')) k += 1;
      if (source[k] === ':') keys.push({ name: source.slice(i, j), offset: i });
      i = j - 1;
    }
    expectKey = false;
  }
  return keys;
}

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
  ['namespaced-globals', namespacedGlobals],
  ['data-operators', dataOperators],
  ['roll-mode', rollMode],
  ['context-menu-keys', contextMenuKeys],
  ['legacy-transferral', legacyTransferral],
  ['unregister-core-sheets', unregisterCoreSheets],
  ['status-effects', statusEffectsAssignment],
  ['active-effect-modes', activeEffectModes],
  ['hooks', hookNotes],
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
 *
 * Edited as text, not re-serialised: a manifest carries its author's
 * indentation, key order and one-line arrays, and a diff that reformats the
 * whole file to add one key is a diff nobody merges. `type` goes on the line
 * after `id`, with that line's indentation; the compatibility values are
 * replaced in place.
 */
export function transformManifest(
  raw: string,
  kind: 'system' | 'module',
): { output: string; changes: Change[]; notes: Note[] } | null {
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const changes: Change[] = [];
  const notes: Note[] = [];
  let output = raw;

  if (parsed.type !== kind) {
    const typeKey = topLevelKey(output, 'type');
    if (typeKey) {
      output = `${output.slice(0, typeKey.valueStart)}"${kind}"${output.slice(typeKey.valueEnd)}`;
      changes.push({
        line: lineAt(raw, typeKey.keyStart),
        before: raw.slice(typeKey.keyStart, typeKey.valueEnd).trim(),
        after: `"type": "${kind}"`,
        rule: 'manifest',
      });
    } else {
      const idKey = topLevelKey(output, 'id');
      if (idKey) {
        const lineStart = output.lastIndexOf('\n', idKey.keyStart) + 1;
        const indent = output.slice(lineStart, idKey.keyStart);
        const after = output.indexOf('\n', idKey.valueEnd);
        const insertAt = after === -1 ? output.length : after;
        const needsComma = !/,\s*$/.test(output.slice(idKey.valueEnd, insertAt));
        const head = needsComma
          ? `${output.slice(0, idKey.valueEnd)},${output.slice(idKey.valueEnd, insertAt)}`
          : output.slice(0, insertAt);
        output = `${head}\n${indent}"type": "${kind}",${output.slice(insertAt)}`;
        changes.push({
          line: lineAt(raw, idKey.keyStart) + 1,
          before: '(no "type")',
          after: `"type": "${kind}"`,
          rule: 'manifest',
        });
      } else {
        notes.push({
          line: 1,
          rule: 'manifest',
          message: `Add \`"type": "${kind}"\` next to "id"; the key could not be placed by hand.`,
        });
      }
    }
  }

  const compatibility = (parsed.compatibility ?? {}) as Record<string, unknown>;
  for (const field of ['minimum', 'verified'] as const) {
    const current = compatibility[field];
    const major = Number.parseInt(String(current ?? '0'), 10);
    if (Number.isFinite(major) && major >= 14) continue;
    const block = topLevelKey(output, 'compatibility');
    const inner = block ? topLevelKey(output.slice(block.valueStart, block.valueEnd), field) : null;
    if (block && inner && current !== undefined) {
      const valueStart = block.valueStart + inner.valueStart;
      const valueEnd = block.valueStart + inner.valueEnd;
      output = `${output.slice(0, valueStart)}"14"${output.slice(valueEnd)}`;
      changes.push({
        line: lineAt(output, block.valueStart + inner.keyStart),
        before: `compatibility.${field}: ${JSON.stringify(current)}`,
        after: `compatibility.${field}: "14"`,
        rule: 'manifest',
      });
      continue;
    }
    notes.push({
      line: 1,
      rule: 'manifest',
      message: `Set compatibility.${field} to "14"; it is ${JSON.stringify(current ?? null)} and could not be edited in place.`,
    });
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
  if (changes.length === 0) return notes.length ? { output: raw, changes, notes } : null;
  JSON.parse(output); // an edit that broke the file is a bug here, not the user's problem
  return { output, changes, notes };
}

/**
 * Where a key of the root object sits in the JSON text: the start of the
 * quoted key, and the span of its value. Only depth one counts, so a
 * `"type"` inside `relationships.systems[]` is not the manifest's `type`.
 */
function topLevelKey(
  json: string,
  key: string,
): { keyStart: number; valueStart: number; valueEnd: number } | null {
  let depth = 0;
  let i = 0;
  const skipString = (from: number): number => {
    let j = from + 1;
    for (; j < json.length; j += 1) {
      if (json[j] === '\\') j += 1;
      else if (json[j] === '"') return j + 1;
    }
    return j;
  };
  const skipValue = (from: number): number => {
    let j = from;
    while (j < json.length && /\s/.test(json[j] ?? '')) j += 1;
    const ch = json[j] ?? '';
    if (ch === '"') return skipString(j);
    if (ch === '{' || ch === '[') {
      let d = 0;
      for (let k = j; k < json.length; k += 1) {
        const c = json[k] ?? '';
        if (c === '"') k = skipString(k) - 1;
        else if (c === '{' || c === '[') d += 1;
        else if (c === '}' || c === ']') {
          d -= 1;
          if (d === 0) return k + 1;
        }
      }
      return json.length;
    }
    while (j < json.length && !/[,}\]\s]/.test(json[j] ?? '')) j += 1;
    return j;
  };
  while (i < json.length) {
    const ch = json[i] ?? '';
    if (ch === '"') {
      const end = skipString(i);
      if (depth === 1) {
        const name = json.slice(i + 1, end - 1);
        let k = end;
        while (k < json.length && /\s/.test(json[k] ?? '')) k += 1;
        if (json[k] === ':') {
          const valueStart = (() => {
            let v = k + 1;
            while (v < json.length && /\s/.test(json[v] ?? '')) v += 1;
            return v;
          })();
          const valueEnd = skipValue(k + 1);
          if (name === key) return { keyStart: i, valueStart, valueEnd };
          i = valueEnd;
          continue;
        }
      }
      i = end;
      continue;
    }
    if (ch === '{' || ch === '[') depth += 1;
    else if (ch === '}' || ch === ']') depth -= 1;
    i += 1;
  }
  return null;
}
