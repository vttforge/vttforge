/**
 * `static get defaultOptions()` → the V2 statics.
 *
 * Reads the object literal handed to `mergeObject(super.defaultOptions, {...})`
 * (or returned directly) and maps the keys the v1 sheets used: `classes`,
 * `template`, `width`/`height`, `resizable`, `submitOnChange`, `tabs`,
 * `dragDrop`. Anything else is listed so the reader decides.
 */
import type { ClassMethod, Expression, ObjectExpression, ObjectProperty } from '@babel/types';
import { methodOf, type SheetClass, text, walk } from './parse.js';

export interface SheetOptions {
  classes: string | null;
  width: number | null;
  height: number | null;
  /** `height: "auto"`, which V2 also accepts. */
  heightAuto: boolean;
  resizable: boolean | null;
  submitOnChange: boolean | null;
  /** FormApplication only. */
  closeOnSubmit: boolean | null;
  /** Application only: `id` and `title` (the window title). */
  id: string | null;
  title: string | null;
  template: string | null;
  templateGetter: ClassMethod | null;
  tabs: Array<{ navSelector: string; contentSelector: string | null; initial: string | null }>;
  dragDrop: string | null;
  unknown: string[];
  /** The options literal read `this` (a subclass static, usually). */
  usesThis: boolean;
}

function keyName(p: ObjectProperty): string | null {
  if (p.key.type === 'Identifier') return p.key.name;
  if (p.key.type === 'StringLiteral') return p.key.value;
  return null;
}

const NOT_A_VALUE = new Set(['ArrayPattern', 'ObjectPattern', 'AssignmentPattern', 'RestElement']);

function props(obj: ObjectExpression): Array<[string, Expression]> {
  const out: Array<[string, Expression]> = [];
  for (const p of obj.properties) {
    if (p.type !== 'ObjectProperty') continue;
    const k = keyName(p);
    if (k && !NOT_A_VALUE.has(p.value.type)) out.push([k, p.value as Expression]);
  }
  return out;
}

/** A string literal, or a template literal with nothing interpolated. */
function str(e: Expression): string | null {
  if (e.type === 'StringLiteral') return e.value;
  if (e.type === 'TemplateLiteral' && e.expressions.length === 0) {
    return e.quasis.map((q) => q.value.cooked ?? q.value.raw).join('');
  }
  return null;
}
function num(e: Expression): number | null {
  return e.type === 'NumericLiteral' ? e.value : null;
}
function bool(e: Expression): boolean | null {
  return e.type === 'BooleanLiteral' ? e.value : null;
}

/** The options literal: the last object argument of the returned call, or the returned object. */
function optionsLiteral(method: ClassMethod): ObjectExpression | null {
  let found: ObjectExpression | null = null;
  walk(method.body, (n) => {
    if (found) return false;
    if (n.type !== 'ReturnStatement' || !n.argument) return undefined;
    const arg = n.argument;
    if (arg.type === 'ObjectExpression') {
      found = arg;
    } else if (arg.type === 'CallExpression') {
      const last = [...arg.arguments].reverse().find((a) => a.type === 'ObjectExpression');
      if (last?.type === 'ObjectExpression') found = last;
    }
    return false;
  });
  return found;
}

export function extractOptions(cls: SheetClass, source: string): SheetOptions {
  const out: SheetOptions = {
    classes: null,
    width: null,
    height: null,
    heightAuto: false,
    resizable: null,
    submitOnChange: null,
    closeOnSubmit: null,
    id: null,
    title: null,
    template: null,
    templateGetter: methodOf(cls.node, 'template', { kind: 'get', static: false }),
    tabs: [],
    dragDrop: null,
    unknown: [],
    usesThis: false,
  };
  const method = methodOf(cls.node, 'defaultOptions', { static: true, kind: 'get' });
  const literal = method ? optionsLiteral(method) : null;
  if (!literal) return out;
  // A getter ran once per subclass, so `this` was the subclass; a static field runs once, on the class that declares it.
  out.usesThis = /\bthis\b/.test(text(source, literal));
  for (const [key, value] of props(literal)) {
    switch (key) {
      case 'classes':
        out.classes = text(source, value);
        break;
      case 'width':
        out.width = num(value);
        break;
      case 'height':
        out.height = num(value);
        out.heightAuto = str(value) === 'auto';
        break;
      case 'closeOnSubmit':
        out.closeOnSubmit = bool(value);
        break;
      case 'id':
        out.id = text(source, value);
        break;
      case 'title':
        out.title = text(source, value);
        break;
      case 'resizable':
        out.resizable = bool(value);
        break;
      case 'submitOnChange':
        out.submitOnChange = bool(value);
        break;
      case 'template':
        out.template = str(value);
        break;
      case 'dragDrop':
        out.dragDrop = text(source, value);
        break;
      case 'tabs':
        out.tabs.push(...readTabs(value));
        break;
      default:
        out.unknown.push(key);
    }
  }
  return out;
}

function readTabs(value: Expression): SheetOptions['tabs'] {
  if (value.type !== 'ArrayExpression') return [];
  const tabs: SheetOptions['tabs'] = [];
  for (const el of value.elements) {
    if (el?.type !== 'ObjectExpression') continue;
    const t = Object.fromEntries(props(el));
    const nav = t.navSelector ? str(t.navSelector) : null;
    if (!nav) continue;
    tabs.push({
      navSelector: nav,
      contentSelector: t.contentSelector ? str(t.contentSelector) : null,
      initial: t.initial ? str(t.initial) : null,
    });
  }
  return tabs;
}

const q = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

/** What the class is: a document sheet on the SDK base, a FormApplication, or a plain Application. */
export type StaticsKind = 'sheet' | 'form' | 'app';

export function renderStatics(
  opts: SheetOptions,
  tabIds: Record<string, string[]>,
  todo: (msg: string) => string,
  kind: StaticsKind = 'sheet',
  className?: string,
): string {
  if (kind === 'form' && !className) {
    throw new Error('renderStatics needs the class name to wire form.handler');
  }
  const lines: string[] = [];
  lines.push('  /** @override */');
  lines.push('  static DEFAULT_OPTIONS = foundry.utils.mergeObject(');
  lines.push('    super.DEFAULT_OPTIONS,');
  lines.push('    {');
  if (kind !== 'sheet' && opts.id) lines.push(`      id: ${opts.id},`);
  if (opts.classes) lines.push(`      classes: ${opts.classes},`);
  if (kind === 'form') lines.push(`      tag: 'form',`);
  if (opts.width !== null || opts.height !== null || opts.heightAuto) {
    const parts = [
      opts.width !== null ? `width: ${opts.width}` : '',
      opts.height !== null ? `height: ${opts.height}` : opts.heightAuto ? `height: 'auto'` : '',
    ].filter(Boolean);
    lines.push(`      position: { ${parts.join(', ')} },`);
  }
  const win = [
    kind !== 'sheet' && opts.title ? `title: ${opts.title}` : '',
    opts.resizable !== null ? `resizable: ${opts.resizable}` : '',
  ].filter(Boolean);
  if (win.length > 0) lines.push(`      window: { ${win.join(', ')} },`);
  if (kind === 'sheet')
    lines.push(`      form: { submitOnChange: ${opts.submitOnChange ?? true} },`);
  if (kind === 'form') {
    lines.push(
      `      form: { handler: ${className}.formHandler, submitOnChange: ${opts.submitOnChange ?? false}, closeOnSubmit: ${opts.closeOnSubmit ?? true} },`,
    );
  }
  lines.push('      actions: {}, // filled below');
  lines.push('    },');
  lines.push('    { inplace: false },');
  lines.push('  );');
  if (opts.usesThis) {
    lines.push(
      `  ${todo('defaultOptions read `this`, which was the subclass each time the getter ran; a static field runs once on the class that declares it. Move what depends on the subclass into _initializeApplicationOptions(options)')}`,
    );
  }
  for (const key of opts.unknown) {
    lines.push(
      `  ${todo(`${key} from defaultOptions has no V2 equivalent here; move it by hand or drop it`)}`,
    );
  }

  if (opts.tabs.length > 0) {
    lines.push('', '  /** @override */', '  static TABS = {');
    for (const [i, tab] of opts.tabs.entries()) {
      // The template edits wire one group. A second nav keeps its v1 markup and needs its own
      // group here plus data-group on its links and panes.
      if (i > 0) {
        lines.push(
          `    ${todo(`${tab.navSelector} is a second tab group; add it here and put data-group on its nav links and panes`)}`,
        );
        continue;
      }
      const group = 'primary';
      const ids = tabIds[tab.navSelector] ?? [];
      const initial = tab.initial ?? ids[0] ?? '';
      if (ids.length === 0) {
        lines.push(
          `    ${todo(`tab ids for ${tab.navSelector} were not found in the template; list them here`)}`,
        );
      }
      lines.push(
        `    ${group}: { tabs: [${ids.map((id) => `{ id: ${q(id)} }`).join(', ')}], initial: ${q(initial)} },`,
      );
    }
    lines.push('  };');
  }
  if (opts.dragDrop) {
    lines.push('', '  /** @override */', `  static DRAG_DROP = ${opts.dragDrop};`);
  }
  const part = kind === 'sheet' ? 'sheet' : kind === 'form' ? 'form' : 'content';
  lines.push('', '  /** @override */', '  static PARTS = {');
  if (opts.template) {
    lines.push(`    ${part}: { template: ${q(opts.template)} },`);
  } else {
    lines.push(
      `    ${todo('the template is chosen at runtime (get template); name one part per type here or override _configureRenderParts')}`,
      `    ${part}: { template: '' },`,
    );
  }
  lines.push('  };');
  return lines.join('\n');
}
