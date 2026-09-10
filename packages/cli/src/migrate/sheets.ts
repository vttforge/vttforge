/**
 * One v1 sheet class → one file on the SDK base.
 *
 * Structure comes from the AST (which members exist, where each one starts
 * and ends); every body is the original text with the scoped rewrites from
 * `sheet-bodies.ts`. The result is meant to be read, not trusted: each place
 * the planner could not decide carries a `// TODO(migrate)` line, and those
 * lines are listed in the report with their line numbers.
 */
import type { ClassMethod } from '@babel/types';
import {
  findSheetClasses,
  methodOf,
  parseSource,
  type SheetClass,
  text,
  unsupportedBases,
} from './parse.js';
import {
  rewriteDialogs,
  rewriteDropMethod,
  rewriteGetData,
  rewriteHandlerBody,
  rewriteUpdateObject,
  TODO,
} from './sheet-bodies.js';
import { type ActionBinding, extractListeners } from './sheet-listeners.js';
import { extractOptions, renderStatics, type StaticsKind } from './sheet-options.js';

export interface SheetPlanFile {
  from: string;
  to: string;
  className: string;
  base: 'BaseActorSheet' | 'BaseItemSheet' | 'ApplicationV2';
  source: string;
  actions: Array<{ name: string; selector: string; method: string }>;
  todos: Array<{ line: number; message: string }>;
  /** Template paths the class names, for the template pass. */
  templates: string[];
  tabNavSelectors: string[];
}

export interface SheetPlan {
  files: SheetPlanFile[];
  notes: string[];
}

/** v1 lifecycle methods a sheet used to override; V2 has other hooks for the same jobs. */
const V1_LIFECYCLE = new Set([
  'setPosition',
  '_getHeaderButtons',
  '_render',
  '_renderInner',
  '_replaceHTML',
  '_onSubmit',
  '_getSubmitData',
  '_onChangeInput',
  'activateEditor',
  'close',
]);

const HANDLED = new Set([
  'defaultOptions',
  'getData',
  'activateListeners',
  '_onDropItem',
  '_onDropActor',
]);
const ACTIONS_PLACEHOLDER = '      actions: {}, // filled below';

function methodName(m: ClassMethod): string | null {
  return m.key.type === 'Identifier' ? m.key.name : null;
}

const pascal = (s: string) => s.replace(/^[a-z]/, (c) => c.toUpperCase());
const single = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

/** Re-indent a member slice so its first line sits at two spaces. */
function reindent(memberText: string): string {
  const lines = memberText.split('\n');
  const first = lines[0] ?? '';
  const rest = lines.slice(1);
  const indents = rest
    .filter((l) => l.trim().length > 0)
    .map((l) => /^[ \t]*/.exec(l)?.[0].length ?? 0);
  const min = indents.length > 0 ? Math.min(...indents) : 0;
  // The body sits one level under the member; keep that level at four spaces.
  const strip = Math.max(0, min - 4);
  const body = rest.map((l) => {
    if (l.trim().length === 0) return '';
    const own = /^[ \t]*/.exec(l)?.[0].length ?? 0;
    return l.slice(Math.min(strip, own));
  });
  return [`  ${first.trimStart()}`, ...body].join('\n');
}

/** Ensure `(event, target)` on a handler method, keeping the event name it used. */
function handlerSignature(
  methodText: string,
  name: string,
): { code: string; eventParam: string | null } {
  const escaped = name.replace(/[$]/g, '\\$');
  const sig = new RegExp(`^(\\s*(?:async\\s+)?${escaped}\\s*\\()([^)]*)(\\))`);
  const m = sig.exec(methodText);
  if (!m) return { code: methodText, eventParam: null };
  const params = (m[2] ?? '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  const eventParam = params[0] ?? null;
  const first = eventParam ?? 'event';
  return { code: methodText.replace(sig, `$1${first}, target$3`), eventParam };
}

/** The first parameter name of a method, from its signature text. */
function firstParam(methodText: string, name: string): string | null {
  const escaped = name.replace(/[$]/g, '\\$');
  const m = new RegExp(`^\\s*(?:async\\s+)?${escaped}\\s*\\(([^)]*)\\)`).exec(methodText);
  const first = (m?.[1] ?? '').split(',')[0]?.trim();
  return first ? first : null;
}

/** Lines after the first sit at `spaces`, keeping their relative indentation. */
function indentTo(snippet: string, spaces: number): string {
  const lines = snippet.split('\n');
  const rest = lines.slice(1);
  const indents = rest
    .filter((l) => l.trim().length > 0)
    .map((l) => /^[ \t]*/.exec(l)?.[0].length ?? 0);
  const min = indents.length > 0 ? Math.min(...indents) : 0;
  const pad = ' '.repeat(spaces);
  return [
    (lines[0] ?? '').trimStart(),
    ...rest.map((l) =>
      l.trim().length === 0
        ? ''
        : `${pad}${l.slice(Math.min(min, /^[ \t]*/.exec(l)?.[0].length ?? 0))}`,
    ),
  ].join('\n');
}

/** A block body lifted out of `activateListeners`: inner lines at four spaces, the brace at two. */
function dedentBlock(block: string): string {
  const lines = block.split('\n');
  if (lines.length < 2) return block;
  const inner = lines.slice(1, -1);
  const indents = inner
    .filter((l) => l.trim().length > 0)
    .map((l) => /^[ \t]*/.exec(l)?.[0].length ?? 0);
  const min = indents.length > 0 ? Math.min(...indents) : 0;
  const body = inner.map((l) =>
    l.trim().length === 0
      ? ''
      : `    ${l.slice(Math.min(min, /^[ \t]*/.exec(l)?.[0].length ?? 0))}`,
  );
  return [lines[0] ?? '{', ...body, '  }'].join('\n');
}

function importLines(source: string, lang: 'js' | 'ts'): string[] {
  const ast = parseSource(source, lang);
  const lines: string[] = [];
  for (const n of ast.program.body) if (n.type === 'ImportDeclaration') lines.push(text(source, n));
  return lines;
}

function isExported(source: string, cls: SheetClass): boolean {
  const start = cls.node.start ?? 0;
  const before = source.slice(Math.max(0, start - 40), start);
  return (
    /export\s+(?:default\s+)?$/.test(before) ||
    new RegExp(`export\\s+\\{[^}]*\\b${cls.name}\\b`).test(source)
  );
}

interface ClassOutput {
  block: string;
  base: SheetPlanFile['base'];
  actions: SheetPlanFile['actions'];
  templates: string[];
  navs: string[];
  usesDialogV2: boolean;
}

function planClass(cls: SheetClass, source: string, tabIds: Record<string, string[]>): ClassOutput {
  const isSheet = cls.base === 'ActorSheet' || cls.base === 'ItemSheet';
  const base: SheetPlanFile['base'] =
    cls.base === 'ActorSheet'
      ? 'BaseActorSheet'
      : cls.base === 'ItemSheet'
        ? 'BaseItemSheet'
        : 'ApplicationV2';
  const kind: StaticsKind = isSheet ? 'sheet' : cls.base === 'FormApplication' ? 'form' : 'app';
  const own = cls.base === 'ActorSheet' ? 'actor' : 'item';
  const options = extractOptions(cls, source);
  const listeners = extractListeners(cls, source);
  const templates = new Set<string>();
  const navs = new Set<string>();
  let usesDialogV2 = false;

  if (options.template) templates.add(options.template);
  if (options.templateGetter) {
    for (const m of text(source, options.templateGetter).matchAll(
      /["'`]([^"'`$]+\.(?:hbs|html))["'`]/g,
    )) {
      if (m[1]) templates.add(m[1]);
    }
  }
  for (const t of options.tabs) navs.add(t.navSelector);

  const members: string[] = [];
  const todo = (msg: string) => TODO(msg);

  // 1. Statics, with the actions block filled in.
  const actionEntries = listeners.actions.map((a) => ({
    name: a.name,
    selector: a.selector,
    method: a.kind === 'method' && a.method ? a.method : `_on${pascal(a.name)}`,
  }));
  const actionsBlock =
    actionEntries.length === 0
      ? '      actions: {},'
      : `      actions: {\n${actionEntries.map((a) => `        ${a.name}: ${cls.name}.prototype.${a.method},`).join('\n')}\n      },`;
  // A runtime `get template()` decides the template; a static one next to it is not the whole story.
  const statics = options.templateGetter ? { ...options, template: null } : options;
  members.push(
    renderStatics(statics, tabIds, todo, kind, cls.name).replace(ACTIONS_PLACEHOLDER, actionsBlock),
  );

  // 2. The document getter.
  if (isSheet && !methodOf(cls.node, own, { kind: 'get' })) {
    members.push(`  get ${own}() {\n    return this.document;\n  }`);
  }
  if (cls.base === 'FormApplication' && /\bthis\.object\b/.test(text(source, cls.node))) {
    members.push(
      `  ${todo('FormApplication carried the edited value as this.object; ApplicationV2 does not. Take it in the constructor and keep it on a field: constructor(object, options) { super(options); this.object = object; }')}`,
    );
  }

  // 3. The template getter, when dynamic.
  if (options.templateGetter) members.push(reindent(text(source, options.templateGetter)));

  // 4. getData → _prepareContext.
  const getData = methodOf(cls.node, 'getData');
  if (getData) members.push(rewriteGetData(reindent(text(source, getData)), cls.base).code);

  // 5. _onRender for the events that are not clicks.
  if (listeners.listeners.length > 0) {
    const body = listeners.listeners
      .map((l) => {
        const param = /^\s*(?:async\s+)?\(?\s*(\w+)/.exec(l.handlerText)?.[1] ?? null;
        const isFunction = /^\s*(?:async\s+)?(?:\(|\w+\s*=>|function\b)/.test(l.handlerText);
        const handler = isFunction
          ? indentTo(
              rewriteHandlerBody(
                l.handlerText,
                param,
                listeners.htmlParam,
                param ? `${param}.currentTarget` : 'target',
              ).code,
              6,
            )
          : l.handlerText;
        return `    for (const el of this.element.querySelectorAll(${single(l.selector)})) {\n      el.addEventListener(${single(l.event)}, ${handler});\n    }`;
      })
      .join('\n');
    members.push(
      `  /** @override */\n  _onRender(context, options) {\n    super._onRender(context, options);\n${body}\n  }`,
    );
  }

  // 6. Every other member, rewritten by role.
  const handlerNames = new Set(
    listeners.actions.filter((a) => a.kind === 'method' && a.method).map((a) => a.method as string),
  );
  // Methods a render listener forwards to keep their event; jQuery on it still goes.
  const listenerTargets = new Set(
    listeners.listeners.flatMap((l) =>
      [...l.handlerText.matchAll(/this\.(\w+)/g)].map((m) => m[1] ?? ''),
    ),
  );
  const applyDialogs = (code: string): string => {
    const d = rewriteDialogs(code);
    if (/DialogV2\./.test(d.code)) usesDialogV2 = true;
    return d.code;
  };
  for (const member of cls.node.body.body) {
    if (
      member.type !== 'ClassMethod' &&
      member.type !== 'ClassProperty' &&
      member.type !== 'ClassPrivateMethod'
    )
      continue;
    const name = member.type === 'ClassMethod' ? methodName(member) : null;
    if (name && HANDLED.has(name)) continue;
    if (name === 'template' && member.type === 'ClassMethod' && member.kind === 'get') continue;
    let code = applyDialogs(reindent(text(source, member)));
    if (name && handlerNames.has(name)) {
      const sig = handlerSignature(code, name);
      code = rewriteHandlerBody(sig.code, sig.eventParam, null).code;
    } else if (name && listenerTargets.has(name)) {
      const ev = firstParam(code, name);
      code = rewriteHandlerBody(code, ev, null, ev ? `${ev}.currentTarget` : 'target').code;
    } else if (member.type === 'ClassMethod') {
      // Any other method: the jQuery idioms with a DOM equivalent, the rest flagged.
      code = rewriteHandlerBody(code, null, null).code;
    }
    if (name && V1_LIFECYCLE.has(name)) {
      code = `  ${todo(`${name} is an Application v1 lifecycle override; ApplicationV2 sizes, submits and builds its header itself. Review it against the V2 method of the same job, or delete it`)}\n${code}`;
    }
    if (name === '_updateObject') {
      code = isSheet
        ? `  ${todo('_updateObject is gone on V2; DocumentSheetV2 submits the form itself. Move any shaping into _prepareSubmitData or delete this')}\n${code}`
        : rewriteUpdateObject(code).code;
    }
    members.push(code);
  }
  for (const which of ['Item', 'Actor'] as const) {
    const m = methodOf(cls.node, `_onDrop${which}`);
    if (!m) continue;
    members.push(applyDialogs(rewriteDropMethod(reindent(text(source, m)), which).code));
  }

  // 7. Inline handlers become methods.
  const inline: ActionBinding[] = listeners.actions.filter((a) => a.kind === 'inline');
  for (const a of inline) {
    const method = `_on${pascal(a.name)}`;
    const rewritten = rewriteHandlerBody(applyDialogs(a.body ?? '{}'), a.param, null).code.trim();
    const body = rewritten.startsWith('{')
      ? dedentBlock(rewritten)
      : `{\n    return ${rewritten};\n  }`;
    members.push(`  ${a.isAsync ? 'async ' : ''}${method}(${a.param ?? 'event'}, target) ${body}`);
  }
  for (const l of listeners.leftovers) {
    members.push(
      `  ${todo(`from activateListeners, line ${l.line}: ${l.text.replace(/\s+/g, ' ')}`)}`,
    );
  }

  const exported = isExported(source, cls);
  const extendsExpr = isSheet ? `${base}()` : 'HandlebarsApplicationMixin(ApplicationV2)';
  const block = `${exported ? 'export ' : ''}class ${cls.name} extends ${extendsExpr} {\n${members.join('\n\n')}\n}`;
  return {
    block,
    base,
    actions: actionEntries,
    templates: [...templates],
    navs: [...navs],
    usesDialogV2,
  };
}

export function planSheetFile(
  relPath: string,
  source: string,
  opts: { lang: 'js' | 'ts'; tabIds: Record<string, string[]> },
): SheetPlan {
  const lang: 'js' | 'ts' = relPath.endsWith('.ts') ? 'ts' : opts.lang;
  const ast = parseSource(source, lang);
  const classes = findSheetClasses(ast, source);
  const notes = unsupportedBases(ast, source).map(
    (u) =>
      `${relPath}:${u.line} ${u.name} extends ${u.superText}; only ActorSheet and ItemSheet are converted, this one stays as it is`,
  );
  if (classes.length === 0) return { files: [], notes };

  const dot = relPath.lastIndexOf('.');
  const to = `${relPath.slice(0, dot)}.v2${relPath.slice(dot)}`;
  const outputs = classes.map((cls) => ({ cls, out: planClass(cls, source, opts.tabIds) }));

  const sdkBases = [
    ...new Set(outputs.map((o) => o.out.base).filter((b) => b !== 'ApplicationV2')),
  ];
  const header = [
    ...(sdkBases.length > 0 ? [`import { ${sdkBases.join(', ')} } from '@vttforge/core';`] : []),
    ...importLines(source, lang),
  ];
  const fromApi = [
    ...(outputs.some((o) => o.out.base === 'ApplicationV2')
      ? ['ApplicationV2', 'HandlebarsApplicationMixin']
      : []),
    ...(outputs.some((o) => o.out.usesDialogV2) ? ['DialogV2'] : []),
  ].sort();
  if (fromApi.length > 0) {
    if (header.length > 0) header.push('');
    header.push(`const { ${fromApi.join(', ')} } = foundry.applications.api;`);
  }
  const fileSource = `${header.join('\n')}\n\n${outputs.map((o) => o.out.block).join('\n\n')}\n`;
  const marker = 'TODO(migrate): ';
  const todos = fileSource.split('\n').flatMap((line, i) => {
    const at = line.indexOf(marker);
    return at === -1 ? [] : [{ line: i + 1, message: line.slice(at + marker.length).trim() }];
  });

  const files: SheetPlanFile[] = outputs.map(({ cls, out }) => ({
    from: relPath,
    to,
    className: cls.name,
    base: out.base,
    source: fileSource,
    actions: out.actions,
    todos,
    templates: out.templates,
    tabNavSelectors: out.navs,
  }));
  return { files, notes };
}
