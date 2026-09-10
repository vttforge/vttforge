/**
 * The parse side of `migrate --sheets`: an AST for the class structure, and
 * the few lookups the planner needs. Bodies are never re-printed from the
 * tree; the planner slices the original text by node range.
 */
import { parse } from '@babel/parser';
import type { ClassDeclaration, ClassExpression, ClassMethod, File, Node } from '@babel/types';

type SheetBase = 'ActorSheet' | 'ItemSheet' | 'Application' | 'FormApplication';

export interface SheetClass {
  name: string;
  base: SheetBase;
  node: ClassDeclaration | ClassExpression;
  /** The `extends` expression as written. */
  superText: string;
}

const CONVERTED = new Set<string>(['ActorSheet', 'ItemSheet', 'Application', 'FormApplication']);
const UNSUPPORTED = new Set(['Dialog', 'DocumentSheet']);

export function parseSource(source: string, lang: 'js' | 'ts'): File {
  return parse(source, {
    sourceType: 'module',
    errorRecovery: true,
    attachComment: false,
    plugins: lang === 'ts' ? ['typescript', 'decorators'] : ['decorators'],
  });
}

export function text(source: string, node: Node): string {
  return source.slice(node.start ?? 0, node.end ?? 0);
}

/** Depth-first over every child node. Return `false` from `visit` to skip a subtree. */
export function walk(node: Node | null | undefined, visit: (n: Node) => undefined | false): void {
  if (!node || typeof node.type !== 'string') return;
  if (visit(node) === false) return;
  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'leadingComments' || key === 'trailingComments') continue;
    const value = (node as unknown as Record<string, unknown>)[key];
    if (Array.isArray(value)) {
      for (const v of value) walk(v as Node, visit);
    } else if (value && typeof value === 'object' && 'type' in value) {
      walk(value as Node, visit);
    }
  }
}

/** `foundry.appv1.sheets.ActorSheet` → the leaf name, or the identifier itself. */
function superName(cls: ClassDeclaration | ClassExpression): string | null {
  const s = cls.superClass;
  if (!s) return null;
  if (s.type === 'Identifier') return s.name;
  if (s.type === 'MemberExpression' && s.property.type === 'Identifier') return s.property.name;
  return null;
}

interface NamedClass {
  name: string;
  node: ClassDeclaration | ClassExpression;
}

function classesOf(ast: File): NamedClass[] {
  const out: NamedClass[] = [];
  walk(ast.program, (n) => {
    if (n.type === 'ClassDeclaration') {
      out.push({ name: n.id?.name ?? '', node: n });
      return false;
    }
    if (n.type === 'ExportDefaultDeclaration' && n.declaration.type === 'ClassDeclaration') {
      const base = superName(n.declaration) ?? 'Sheet';
      out.push({ name: n.declaration.id?.name ?? `Default${base}`, node: n.declaration });
      return false;
    }
    if (
      n.type === 'VariableDeclarator' &&
      n.init?.type === 'ClassExpression' &&
      n.id.type === 'Identifier'
    ) {
      out.push({ name: n.id.name, node: n.init });
      return false;
    }
    return undefined;
  });
  return out;
}

export function findSheetClasses(ast: File, source: string): SheetClass[] {
  const found: SheetClass[] = [];
  for (const { name, node } of classesOf(ast)) {
    const base = superName(node);
    if (!base || !CONVERTED.has(base) || !node.superClass) continue;
    found.push({ name, base: base as SheetBase, node, superText: text(source, node.superClass) });
  }
  return found;
}

export function unsupportedBases(
  ast: File,
  source: string,
): Array<{ name: string; superText: string; line: number }> {
  const out: Array<{ name: string; superText: string; line: number }> = [];
  for (const { name, node } of classesOf(ast)) {
    const base = superName(node);
    if (!base || !UNSUPPORTED.has(base) || !node.superClass) continue;
    out.push({ name, superText: text(source, node.superClass), line: node.loc?.start.line ?? 0 });
  }
  return out;
}

export function methodOf(
  cls: ClassDeclaration | ClassExpression,
  name: string,
  opts: { static?: boolean; kind?: 'get' | 'method' } = {},
): ClassMethod | null {
  for (const member of cls.body.body) {
    if (member.type !== 'ClassMethod') continue;
    if (member.key.type !== 'Identifier' || member.key.name !== name) continue;
    if (opts.static !== undefined && Boolean(member.static) !== opts.static) continue;
    if (opts.kind !== undefined && member.kind !== opts.kind) continue;
    return member;
  }
  return null;
}
