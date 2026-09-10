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

/** Index just past the `)` that closes the call opened at `open` (which must point at `(`), or -1. */
function closingParen(text: string, open: number): number {
  const masked = maskComments(text, { strings: true });
  let depth = 0;
  for (let i = open; i < masked.length; i += 1) {
    const ch = masked[i];
    if (ch === MASK) continue;
    if (ch === '(' || ch === '[' || ch === '{') depth += 1;
    else if (ch === ')' || ch === ']' || ch === '}') {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

/** Strip one pair of outer braces from an object literal's text. */
function innerOf(objectText: string): string | null {
  const t = objectText.trim();
  if (!t.startsWith('{') || !t.endsWith('}')) return null;
  return t.slice(1, -1);
}

/** `'<i class="fas fa-check"></i>'` → `'fas fa-check'`; anything else stays. */
function iconClass(value: string): string {
  const m = /<i\s+class=(["'])([^"']+)\1/.exec(value);
  if (!m) return value;
  const q = value.trim().startsWith('"') ? '"' : "'";
  return `${q}${m[2]}${q}`;
}

/**
 * A v1 dialog callback `(html) => ...` on the V2 signature. `html` was the
 * dialog's jQuery content; V2 hands `(event, button, dialog)`, so `html[0]`
 * is `dialog.element` and `html.find(sel)` is a query on it.
 */
function v2Callback(fn: string, signature: string, elementExpr: string): string {
  const arrow = /^(async\s+)?\(?\s*([\w$]*)\s*\)?\s*=>/.exec(fn.trim());
  const classic = /^(async\s+)?function\s*\(\s*([\w$]*)\s*\)/.exec(fn.trim());
  const m = arrow ?? classic;
  if (!m) return fn;
  const param = m[2] ?? '';
  const head = arrow ? `${m[1] ?? ''}(${signature}) =>` : `${m[1] ?? ''}function (${signature})`;
  let body = fn.trim().slice(m[0].length);
  if (param) {
    const p = esc(param);
    body = replaceCode(body, new RegExp(`\\b${p}\\[0\\]`, 'g'), () => elementExpr);
    body = replaceCode(
      body,
      new RegExp(`\\b${p}\\.find\\(`, 'g'),
      () => `${elementExpr}.querySelector(`,
    );
    body = replaceCode(body, new RegExp(`\\$\\(\\s*${p}\\s*\\)`, 'g'), () => elementExpr);
    body = replaceCode(body, new RegExp(`\\b${p}\\b(?!\\s*:)`, 'g'), () => elementExpr);
  }
  body = replaceCode(body, /\.val\(\)/g, () => '.value');
  return `${head}${body}`;
}

const NEW_DIALOG_WAIT_NOTE =
  'DialogV2.wait opens the dialog itself and resolves with the pressed button; drop any later .render(true) on this value and await it where the result matters';

interface DialogRead {
  code: string;
  missing: string[];
}

/** `new Dialog({...})` options → the `DialogV2.wait({...})` call, or null when unreadable. */
function readDialogOptions(inner: string, indent: string): DialogRead | null {
  if (!balanced(inner)) return null;
  const missing: string[] = [];
  const found: Record<string, string> = {};
  for (const pair of topLevelPairs(inner)) {
    if (pair.spread) {
      missing.push(`the spread ${pair.key}`);
      continue;
    }
    const key = pair.key.replace(/^['"]|['"]$/g, '');
    if (['title', 'content', 'buttons', 'default', 'render', 'close'].includes(key))
      found[key] = pair.value;
    else missing.push(key);
  }
  const pad = `${indent}  `;
  const parts: string[] = [];
  if (found.title) parts.push(`window: { title: ${found.title} }`);
  if (found.content) parts.push(`content: ${found.content}`);
  if (found.buttons) {
    const buttonsInner = innerOf(found.buttons);
    if (buttonsInner === null || !balanced(buttonsInner)) return null;
    const defaultKey = found.default?.replace(/^['"]|['"]$/g, '');
    const buttons: string[] = [];
    for (const b of topLevelPairs(buttonsInner)) {
      if (b.spread) {
        missing.push(`the spread ${b.key} in buttons`);
        continue;
      }
      const action = b.key.replace(/^['"]|['"]$/g, '');
      const fields = innerOf(b.value);
      if (fields === null) {
        missing.push(`button ${action}`);
        continue;
      }
      const entry: string[] = [`action: '${action}'`];
      for (const f of topLevelPairs(fields)) {
        const k = f.key.replace(/^['"]|['"]$/g, '');
        if (k === 'icon') entry.push(`icon: ${iconClass(f.value)}`);
        else if (k === 'label') entry.push(`label: ${f.value}`);
        else if (k === 'callback')
          entry.push(`callback: ${v2Callback(f.value, 'event, button, dialog', 'dialog.element')}`);
        else missing.push(`button ${action}.${k}`);
      }
      if (defaultKey && defaultKey === action) entry.push('default: true');
      buttons.push(`${pad}  { ${entry.join(', ')} },`);
    }
    parts.push(`buttons: [\n${buttons.join('\n')}\n${pad}]`);
  }
  if (found.render)
    parts.push(`render: ${v2Callback(found.render, 'event, dialog', 'dialog.element')}`);
  if (found.close) parts.push(`close: ${found.close}`);
  const code = `DialogV2.wait({\n${parts.map((p) => `${pad}${p},`).join('\n')}\n${indent}})`;
  return { code, missing };
}

/** `Dialog.prompt({...})` options → `DialogV2.prompt({...})`, or null when unreadable. */
function readPromptOptions(inner: string): DialogRead | null {
  if (!balanced(inner)) return null;
  const missing: string[] = [];
  const found: Record<string, string> = {};
  for (const pair of topLevelPairs(inner)) {
    if (pair.spread) {
      missing.push(`the spread ${pair.key}`);
      continue;
    }
    const key = pair.key.replace(/^['"]|['"]$/g, '');
    if (['title', 'content', 'label', 'callback', 'rejectClose'].includes(key))
      found[key] = pair.value;
    else missing.push(key);
  }
  const parts: string[] = [];
  if (found.title) parts.push(`window: { title: ${found.title} }`);
  if (found.content) parts.push(`content: ${found.content}`);
  const ok: string[] = [];
  if (found.label) ok.push(`label: ${found.label}`);
  if (found.callback)
    ok.push(`callback: ${v2Callback(found.callback, 'event, button, dialog', 'dialog.element')}`);
  if (ok.length > 0) parts.push(`ok: { ${ok.join(', ')} }`);
  if (found.rejectClose) parts.push(`rejectClose: ${found.rejectClose}`);
  return { code: `DialogV2.prompt({ ${parts.join(', ')} })`, missing };
}

/**
 * Replace each `<pattern>({...}[, more])` whose first argument is a readable
 * object literal; leave the rest as written with a TODO above it.
 */
function rewriteCalls(
  code: string,
  pattern: RegExp,
  read: (inner: string, indent: string) => DialogRead | null,
  label: string,
  todos: string[],
): string {
  const masked = maskComments(code, { strings: true });
  const hits: Array<{
    start: number;
    end: number;
    read: DialogRead | null;
    trailingRender: boolean;
  }> = [];
  for (const m of code.matchAll(pattern)) {
    const start = m.index ?? 0;
    if (masked[start] === MASK) continue;
    const open = start + m[0].length - 1;
    const end = closingParen(code, open);
    if (end === -1) continue;
    const args = code.slice(open + 1, end - 1);
    // The first argument is the options literal; anything after its closing brace is a second one.
    const firstBrace = args.indexOf('{');
    const firstEnd = firstBrace === -1 ? -1 : closingParen(args, firstBrace);
    const argsInner =
      firstEnd === -1 || args.slice(0, firstBrace).trim() !== ''
        ? null
        : innerOf(args.slice(firstBrace, firstEnd));
    const secondArg = firstEnd !== -1 && /^\s*,\s*\S/.test(args.slice(firstEnd));
    const lineStart = code.lastIndexOf('\n', start - 1) + 1;
    const indent = /^[ \t]*/.exec(code.slice(lineStart))?.[0] ?? '';
    const result = argsInner === null ? null : read(argsInner, indent);
    if (result && secondArg) result.missing.push('the second argument (the Application options)');
    let renderEnd = end;
    let trailingRender = false;
    const after = /^\s*\.render\((?:true)?\)/.exec(code.slice(end));
    if (after) {
      renderEnd = end + after[0].length;
      trailingRender = true;
    }
    hits.push({ start, end: renderEnd, read: result, trailingRender });
  }
  let out = code;
  for (const hit of hits.reverse()) {
    if (hit.read === null) {
      out = todoAt(
        out,
        hit.start,
        `${label} here could not be read; rewrite it on DialogV2 by hand (${NEW_DIALOG_MSG})`,
      );
      todos.unshift(
        `${label} here could not be read; rewrite it on DialogV2 by hand (${NEW_DIALOG_MSG})`,
      );
      continue;
    }
    out = `${out.slice(0, hit.start)}${hit.read.code}${out.slice(hit.end)}`;
    if (hit.read.missing.length > 0) {
      const msg = `${label} options left behind: ${hit.read.missing.join(', ')}; move them onto the DialogV2 call by hand`;
      out = todoAt(out, hit.start, msg);
      todos.unshift(msg);
    }
    if (label === 'new Dialog' && !hit.trailingRender) {
      out = todoAt(out, hit.start, NEW_DIALOG_WAIT_NOTE);
      todos.unshift(NEW_DIALOG_WAIT_NOTE);
    }
  }
  return out;
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

  // Dialog.prompt({...}) → DialogV2.prompt({...})
  out = rewriteCalls(
    out,
    /\bDialog\.prompt\s*\(/g,
    (inner) => readPromptOptions(inner),
    'Dialog.prompt',
    todos,
  );
  // new Dialog({...}).render(true) → DialogV2.wait({...})
  out = rewriteCalls(
    out,
    NEW_DIALOG,
    (inner, indent) => readDialogOptions(inner, indent),
    'new Dialog',
    todos,
  );
  return { code: out, todos };
}
