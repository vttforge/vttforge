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
  resizable: boolean | null;
  submitOnChange: boolean | null;
  template: string | null;
  templateGetter: ClassMethod | null;
  tabs: Array<{ navSelector: string; contentSelector: string | null; initial: string | null }>;
  dragDrop: string | null;
  unknown: string[];
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

function str(e: Expression): string | null {
  return e.type === 'StringLiteral' ? e.value : null;
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
    resizable: null,
    submitOnChange: null,
    template: null,
    templateGetter: methodOf(cls.node, 'template', { kind: 'get', static: false }),
    tabs: [],
    dragDrop: null,
    unknown: [],
  };
  const method = methodOf(cls.node, 'defaultOptions', { static: true, kind: 'get' });
  const literal = method ? optionsLiteral(method) : null;
  if (!literal) return out;
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

export function renderStatics(
  opts: SheetOptions,
  tabIds: Record<string, string[]>,
  todo: (msg: string) => string,
): string {
  const lines: string[] = [];
  lines.push('  /** @override */');
  lines.push('  static DEFAULT_OPTIONS = foundry.utils.mergeObject(');
  lines.push('    super.DEFAULT_OPTIONS,');
  lines.push('    {');
  if (opts.classes) lines.push(`      classes: ${opts.classes},`);
  if (opts.width !== null || opts.height !== null) {
    const parts = [
      opts.width !== null ? `width: ${opts.width}` : '',
      opts.height !== null ? `height: ${opts.height}` : '',
    ].filter(Boolean);
    lines.push(`      position: { ${parts.join(', ')} },`);
  }
  if (opts.resizable !== null) lines.push(`      window: { resizable: ${opts.resizable} },`);
  lines.push(`      form: { submitOnChange: ${opts.submitOnChange ?? true} },`);
  lines.push('      actions: {}, // filled below');
  lines.push('    },');
  lines.push('    { inplace: false },');
  lines.push('  );');
  for (const key of opts.unknown) {
    lines.push(
      `  ${todo(`${key} from defaultOptions has no V2 equivalent here; move it by hand or drop it`)}`,
    );
  }

  if (opts.tabs.length > 0) {
    lines.push('', '  /** @override */', '  static TABS = {');
    for (const [i, tab] of opts.tabs.entries()) {
      const group = i === 0 ? 'primary' : `group${i + 1}`;
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
  lines.push('', '  /** @override */', '  static PARTS = {');
  if (opts.template) {
    lines.push(`    sheet: { template: ${q(opts.template)} },`);
  } else {
    lines.push(
      `    ${todo('the template is chosen at runtime (get template); name one part per type here or override _configureRenderParts')}`,
      `    sheet: { template: '' },`,
    );
  }
  lines.push('  };');
  return lines.join('\n');
}
