/**
 * Text rewrites applied to method bodies carried over from an Application v1
 * sheet. Each one is scoped to the slice the planner hands it, so a pattern
 * here never sees the rest of the file.
 *
 * Nothing is re-printed from a syntax tree: the bodies keep the author's
 * spacing and comments, and every rewrite is a replacement the reader can
 * find in the diff. What cannot be decided mechanically becomes a
 * `// TODO(migrate)` line above the code that needs the decision, and the
 * same message comes back in `todos` so the report can list it.
 */

import { MASK, maskComments } from '../audit/mask.js';

export interface Rewritten {
  code: string;
  /** One message per `// TODO(migrate)` line placed in `code`. */
  todos: string[];
}

export const TODO = (msg: string): string => `// TODO(migrate): ${msg}`;

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const camel = (s: string) => s.replace(/-+(\w)/g, (_m, c: string) => c.toUpperCase());

/** Replace outside comments and strings; the mask keeps them out of reach. */
function replaceCode(
  code: string,
  pattern: RegExp,
  replacement: (match: string, ...groups: string[]) => string,
): string {
  const masked = maskComments(code, { strings: true });
  return code.replace(pattern, (match: string, ...rest: unknown[]) => {
    const offset = rest.find((r): r is number => typeof r === 'number') ?? 0;
    if (masked[offset] === MASK) return match;
    return replacement(match, ...rest.filter((r): r is string => typeof r === 'string'));
  });
}

/** Put a TODO line above the line that holds `index`. */
function todoAt(code: string, index: number, msg: string): string {
  const lineStart = code.lastIndexOf('\n', index - 1) + 1;
  const indent = /^[ \t]*/.exec(code.slice(lineStart))?.[0] ?? '';
  return `${code.slice(0, lineStart)}${indent}${TODO(msg)}\n${code.slice(lineStart)}`;
}

/** The jQuery calls with no one-to-one DOM rewrite. */
const LEFTOVER_JQUERY =
  /\$\(|\.(?:val|text|html|prop|toggle|slideToggle|slideUp|slideDown|show|hide|addClass|removeClass|toggleClass|siblings|children|find|css)\(/g;

const JQUERY_MSG = 'jQuery left here; use the DOM on `target` / `this.element`';

/**
 * A handler body from `activateListeners`, with `event.currentTarget` folded
 * into the `target` the action receives and the jQuery data readers turned
 * into `dataset`.
 */
export function rewriteHandlerBody(
  body: string,
  eventParam: string | null,
  htmlParam: string | null,
  targetName = 'target',
): Rewritten {
  const todos: string[] = [];
  let code = body;
  if (eventParam) {
    const ev = esc(eventParam);
    code = replaceCode(
      code,
      new RegExp(`\\$\\(\\s*${ev}\\.currentTarget\\s*\\)`, 'g'),
      () => targetName,
    );
    if (targetName !== `${eventParam}.currentTarget`) {
      code = replaceCode(code, new RegExp(`\\b${ev}\\.currentTarget\\b`, 'g'), () => targetName);
    }
  }
  code = replaceCode(
    code,
    /\.data\(\s*(['"])([\w-]+)\1\s*\)/g,
    (_m, _q, key) => `.dataset.${camel(key)}`,
  );
  code = replaceCode(
    code,
    /\.attr\(\s*(['"])data-([\w-]+)\1\s*\)/g,
    (_m, _q, key) => `.dataset.${camel(key)}`,
  );
  // jQuery's `parents(sel)` is read for its nearest match everywhere a sheet uses it.
  code = replaceCode(code, /\.parents\(/g, () => '.closest(');
  if (htmlParam) {
    code = replaceCode(
      code,
      new RegExp(`\\b${esc(htmlParam)}\\.find\\(`, 'g'),
      () => 'this.element.querySelectorAll(',
    );
  }
  // `this.element` was jQuery on v1 and is an HTMLElement on V2.
  // A jQuery collection reads as a NodeList: `.length`, `[0]` and `forEach` keep working.
  code = replaceCode(code, /this\.element\.find\(/g, () => 'this.element.querySelectorAll(');
  // What is left of jQuery gets a marker, once per line however much it holds.
  const masked = maskComments(code, { strings: true });
  const lines = new Set<number>();
  for (const m of code.matchAll(LEFTOVER_JQUERY)) {
    const at = m.index ?? 0;
    if (masked[at] === MASK) continue;
    lines.add(code.lastIndexOf('\n', at - 1) + 1);
  }
  for (const lineStart of [...lines].sort((a, b) => b - a)) {
    code = todoAt(code, lineStart, JQUERY_MSG);
    todos.unshift(JQUERY_MSG);
  }
  return { code, todos };
}

/**
 * `getData()` becomes `_prepareContext(options)`. V2 hands back a much
 * smaller context, so the keys a v1 body expects to already be there are
 * assigned right after the `super` call — unless the method assigns them
 * itself without reading the old value first.
 */
export function rewriteGetData(methodText: string, base: 'ActorSheet' | 'ItemSheet'): Rewritten {
  const todos: string[] = [];
  const sig = /^(\s*)(async\s+)?getData\s*\(([^)]*)\)/.exec(methodText);
  const params = sig?.[3]?.trim() ?? '';
  let code = methodText.replace(
    /^(\s*)(async\s+)?getData\s*\(([^)]*)\)/,
    (_m, indent: string) => `${indent}async _prepareContext(options)`,
  );
  code = replaceCode(code, /super\.getData\(\s*[^)]*\)/g, () => 'super._prepareContext(options)');

  // The variable that received super's result.
  const varMatch =
    /(?:const|let|var)\s+(\w+)\s*=\s*(?:await\s+)?super\._prepareContext\(options\)\s*;/.exec(code);
  const v = varMatch?.[1] ?? 'context';
  const own = base === 'ActorSheet' ? 'actor' : 'item';
  // What v1's getData handed the template and V2's _prepareContext does not:
  // the document under its own name and as `data`, its system, the items,
  // and the two flags every v1 template gates on.
  const wanted: Array<[string, string]> = [
    [own, `${v}.${own} = this.document;`],
    ['data', `${v}.data = this.document;`],
    ['system', `${v}.system = this.document.system;`],
  ];
  if (base === 'ActorSheet') wanted.push(['items', `${v}.items = [...this.document.items];`]);
  wanted.push(
    ['editable', `${v}.editable = this.isEditable;`],
    ['owner', `${v}.owner = this.document.isOwner;`],
  );

  const masked = maskComments(code, { strings: true });
  const inject = wanted
    .filter(([key]) => {
      const assigned = new RegExp(`\\b${esc(v)}\\.${key}\\s*=(?!=)`).test(masked);
      const read = new RegExp(`\\b${esc(v)}\\.${key}\\b(?!\\s*=(?!=))`).test(masked);
      return !assigned || read;
    })
    .map(([, line]) => line);

  if (varMatch) {
    const at = varMatch.index + varMatch[0].length;
    const indent =
      /^[ \t]*/.exec(code.slice(code.lastIndexOf('\n', varMatch.index) + 1))?.[0] ?? '    ';
    code = `${code.slice(0, at)}${inject.map((l) => `\n${indent}${l}`).join('')}${code.slice(at)}`;
  } else if (inject.length > 0) {
    const msg = `set ${inject.join(' ')} on the context before returning it`;
    code = todoAt(code, code.indexOf('{') + 1, msg);
    todos.push(msg);
  }

  if (params !== '' && params !== 'options') {
    const msg = `\`getData(${params})\` took its own parameters; \`_prepareContext(options)\` does not. Read what the body needs from \`options\` or \`this.document\``;
    code = todoAt(code, code.indexOf('{') + 1, msg);
    todos.push(msg);
  }
  return { code, todos };
}

/**
 * `_onDropItem(event, data)` becomes `onDropItem(item, event)`: the SDK base
 * resolves the dropped document before it calls the hook, so the raw drop
 * payload the v1 body read is gone.
 */
export function rewriteDropMethod(methodText: string, which: 'Item' | 'Actor'): Rewritten {
  const lower = which.toLowerCase();
  const sig = new RegExp(`_onDrop${which}\\s*\\(\\s*(\\w+)\\s*,\\s*(\\w+)\\s*\\)`);
  const m = sig.exec(methodText);
  if (!m) return { code: methodText, todos: [] };
  const eventName = m[1] ?? 'event';
  const dataName = m[2] ?? 'data';
  // The body may already declare `item` / `actor`; the parameter then takes another name.
  const declares = new RegExp(
    `\\b(?:const|let|var)\\s+(?:${lower}\\b|\\{[^}]*\\b${lower}\\b[^}]*\\}|\\[[^\\]]*\\b${lower}\\b[^\\]]*\\])`,
  ).test(methodText);
  const param = declares ? `dropped${which}` : lower;
  let code = methodText.replace(sig, `onDrop${which}(${param}, ${eventName})`);
  const todos: string[] = [];
  if (which === 'Item') {
    // v1's super created the item on the actor and returned the created documents.
    code = replaceCode(
      code,
      /super\._onDropItem\([^)]*\)/g,
      () => `this.document.createEmbeddedDocuments('Item', [${param}.toObject()])`,
    );
  } else {
    code = replaceCode(
      code,
      new RegExp(`super\\._onDrop${which}\\([^)]*\\)`, 'g'),
      () => `super.onDrop${which}(${param}, ${eventName})`,
    );
  }
  // The v1 body read the drag payload; the resolved document reproduces it.
  code = replaceCode(
    code,
    new RegExp(`\\b${esc(dataName)}\\b`, 'g'),
    () => `${param}.toDragData()`,
  );
  const msg =
    which === 'Item'
      ? `the base hands the resolved Item as \`${param}\`; the old \`${dataName}\` payload is now \`${param}.toDragData()\`, read \`${param}\` directly where you can. The old super call created it on the actor, which is what the createEmbeddedDocuments line does now (a drop from the same actor used to re-sort instead). Return true when the drop was handled, undefined to let the base do its default`
      : `the base hands the resolved Actor as \`${param}\`; the old \`${dataName}\` payload is now \`${param}.toDragData()\`, read \`${param}\` directly where you can. Return true when the drop was handled`;
  code = todoAt(code, code.indexOf('{') + 1, msg);
  todos.push(msg);
  return { code, todos };
}

/** `Dialog.confirm({ ... })`: the options literal is group 1. Non-greedy, so a nested `}` ends it early; `balanced` catches that. */
const CONFIRM_CALL = /\bDialog\.confirm\(\s*\{([\s\S]*?)\}\s*\)/g;
const NEW_DIALOG = /\bnew\s+Dialog\s*\(/g;
const UNREADABLE_MSG =
  'Dialog.confirm here could not be read (a nested object or a comma inside an option); rewrite it as DialogV2.confirm({ window: { title }, content, yes: { callback }, no: { callback } }) by hand';
const NEW_DIALOG_MSG =
  'Dialog v1 (removed in v16); rebuild with DialogV2.prompt / DialogV2.wait, buttons as { action, label, callback }';

/** Whether every bracket opened in `text` (outside strings and comments) is closed. */
function balanced(text: string): boolean {
  const masked = maskComments(text, { strings: true });
  const pairs = new Map<string, string>([
    [')', '('],
    [']', '['],
    ['}', '{'],
  ]);
  const stack: string[] = [];
  for (let i = 0; i < masked.length; i += 1) {
    const ch = masked[i];
    if (ch === undefined || ch === MASK) continue;
    if (ch === '(' || ch === '[' || ch === '{') stack.push(ch);
    else if (pairs.has(ch)) {
      if (stack.pop() !== pairs.get(ch)) return false;
    }
  }
  return stack.length === 0;
}

/** The top-level `key: value` pairs of an object literal's inner text. */
function topLevelPairs(inner: string): Array<{ key: string; value: string; spread: boolean }> {
  const masked = maskComments(inner, { strings: true });
  const pairs: Array<{ key: string; value: string; spread: boolean }> = [];
  let depth = 0;
  let start = 0;
  const flush = (end: number) => {
    const raw = inner.slice(start, end).trim();
    if (!raw) return;
    if (raw.startsWith('...')) {
      pairs.push({ key: raw, value: '', spread: true });
      return;
    }
    const colon = raw.indexOf(':');
    if (colon === -1) {
      pairs.push({ key: raw, value: raw, spread: false });
      return;
    }
    pairs.push({
      key: raw.slice(0, colon).trim(),
      value: raw.slice(colon + 1).trim(),
      spread: false,
    });
  };
  for (let i = 0; i < masked.length; i += 1) {
    const ch = masked[i];
    if (ch === MASK) continue;
    if (ch === '(' || ch === '[' || ch === '{') depth += 1;
    else if (ch === ')' || ch === ']' || ch === '}') depth -= 1;
    else if (ch === ',' && depth === 0) {
      flush(i);
      start = i + 1;
    }
  }
  flush(inner.length);
  return pairs;
}

/**
 * The DialogV2.confirm call for a Dialog.confirm options literal, or `null`
 * when the literal could not be read. `missing` names what the rewrite left
 * behind (a spread, an option with no V2 slot). `defaultYes` is dropped on
 * purpose: DialogV2 has no equivalent.
 */
function readConfirmOptions(inner: string): { code: string | null; missing: string[] } {
  if (!balanced(inner)) return { code: null, missing: [] };
  const missing: string[] = [];
  const found: Record<string, string> = {};
  for (const pair of topLevelPairs(inner)) {
    if (pair.spread) {
      missing.push(`the spread ${pair.key}`);
      continue;
    }
    const key = pair.key.replace(/^['"]|['"]$/g, '');
    if (key === 'title' || key === 'content' || key === 'yes' || key === 'no')
      found[key] = pair.value;
    else if (key !== 'defaultYes' && key !== 'rejectClose' && key !== 'options') missing.push(key);
  }
  const parts = [
    found.title ? `window: { title: ${found.title} }` : '',
    found.content ? `content: ${found.content}` : '',
    found.yes ? `yes: { callback: ${found.yes} }` : '',
    found.no ? `no: { callback: ${found.no} }` : '',
  ].filter(Boolean);
  return { code: `DialogV2.confirm({ ${parts.join(', ')} })`, missing };
}

export function rewriteDialogs(code: string): Rewritten {
  const todos: string[] = [];
  const confirmMask = maskComments(code, { strings: true });
  const hits: Array<{ start: number; end: number; code: string | null; missing: string[] }> = [];
  for (const m of code.matchAll(CONFIRM_CALL)) {
    const start = m.index ?? 0;
    if (confirmMask[start] === MASK) continue;
    const read = readConfirmOptions(m[1] ?? '');
    hits.push({ start, end: start + m[0].length, code: read.code, missing: read.missing });
  }

  let out = code;
  for (const hit of hits.reverse()) {
    if (hit.code !== null) out = `${out.slice(0, hit.start)}${hit.code}${out.slice(hit.end)}`;
    if (hit.code === null) {
      out = todoAt(out, hit.start, UNREADABLE_MSG);
      todos.unshift(UNREADABLE_MSG);
    } else if (hit.missing.length > 0) {
      const msg = `Dialog.confirm options left behind: ${hit.missing.join(', ')}; move them onto the DialogV2.confirm call by hand`;
      out = todoAt(out, hit.start, msg);
      todos.unshift(msg);
    }
  }

  const dialogMask = maskComments(out, { strings: true });
  const starts: number[] = [];
  for (const m of out.matchAll(NEW_DIALOG)) {
    const at = m.index ?? 0;
    if (dialogMask[at] !== MASK) starts.push(at);
  }
  for (const at of starts.reverse()) {
    out = todoAt(out, at, NEW_DIALOG_MSG);
    todos.push(NEW_DIALOG_MSG);
  }
  return { code: out, todos };
}
