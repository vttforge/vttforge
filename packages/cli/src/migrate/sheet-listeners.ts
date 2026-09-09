/**
 * `activateListeners(html)` → `actions` and `_onRender` listeners.
 *
 * A click bound through `html.find(SEL).click(H)` (or `.on('click', H)`)
 * becomes an action named after the selector's first class or id. A bound
 * method stays a method; an arrow that only forwards to a method is that
 * method; any other function becomes a new method. Other events keep a real
 * listener, added in `_onRender`. What does not fit either shape is listed.
 */
import type { Expression, Node, Statement } from '@babel/types';
import { methodOf, type SheetClass, text } from './parse.js';

export interface ActionBinding {
  name: string;
  selector: string;
  kind: 'method' | 'inline';
  method: string | null;
  param: string | null;
  body: string | null;
  isAsync: boolean;
}

interface ListenerBinding {
  selector: string;
  event: string;
  handlerText: string;
}

export interface Listeners {
  actions: ActionBinding[];
  listeners: ListenerBinding[];
  leftovers: Array<{ line: number; text: string }>;
  /** The name `activateListeners` gave its jQuery root (`html` by convention). */
  htmlParam: string;
}

const EVENTS = new Set([
  'click',
  'dblclick',
  'change',
  'contextmenu',
  'input',
  'keydown',
  'keyup',
  'focus',
  'blur',
  'mouseenter',
  'mouseleave',
  'submit',
]);

const FIRST_CLASS_OR_ID = /[.#]([A-Za-z_][\w-]*)/;
const SEPARATOR = /[-_]+(\w)/g;

export function actionName(selector: string, taken: Set<string>): string | null {
  const match = FIRST_CLASS_OR_ID.exec(selector);
  const captured = match?.[1];
  if (!captured) return null;
  const base = captured
    .replace(SEPARATOR, (_, c: string) => c.toUpperCase())
    .replace(/^[A-Z]/, (c) => c.toLowerCase());
  let name = base;
  let i = 2;
  while (taken.has(name)) {
    name = `${base}${i}`;
    i += 1;
  }
  taken.add(name);
  return name;
}

/** `html.find(SEL)` with `html` being the listener's parameter → the selector. */
function findSelector(callee: Expression, htmlParam: string): string | null {
  if (callee.type !== 'CallExpression') return null;
  const c = callee.callee;
  if (
    c.type !== 'MemberExpression' ||
    c.object.type !== 'Identifier' ||
    c.object.name !== htmlParam
  ) {
    return null;
  }
  if (c.property.type !== 'Identifier' || c.property.name !== 'find') return null;
  const [arg] = callee.arguments;
  return arg && arg.type === 'StringLiteral' ? arg.value : null;
}

/** `this._onX.bind(this)` → `_onX`; `(ev) => this._onX(ev)` → `_onX`. */
function forwardedMethod(handler: Node): string | null {
  if (
    handler.type === 'CallExpression' &&
    handler.callee.type === 'MemberExpression' &&
    handler.callee.property.type === 'Identifier' &&
    handler.callee.property.name === 'bind' &&
    handler.callee.object.type === 'MemberExpression' &&
    handler.callee.object.object.type === 'ThisExpression' &&
    handler.callee.object.property.type === 'Identifier'
  ) {
    return handler.callee.object.property.name;
  }
  if (handler.type === 'ArrowFunctionExpression') {
    let call: Expression | null = null;
    if (handler.body.type === 'CallExpression') call = handler.body;
    else if (handler.body.type === 'BlockStatement' && handler.body.body.length === 1) {
      const only = handler.body.body[0];
      if (only?.type === 'ExpressionStatement' && only.expression.type === 'CallExpression') {
        call = only.expression;
      }
      if (only?.type === 'ReturnStatement' && only.argument?.type === 'CallExpression') {
        call = only.argument;
      }
    }
    if (
      call &&
      call.callee.type === 'MemberExpression' &&
      call.callee.object.type === 'ThisExpression' &&
      call.callee.property.type === 'Identifier' &&
      call.arguments.length <= 1
    ) {
      const [a] = call.arguments;
      const p = handler.params[0];
      if (!a || (a.type === 'Identifier' && p?.type === 'Identifier' && a.name === p.name)) {
        return call.callee.property.name;
      }
    }
  }
  return null;
}

interface Bound {
  selector: string;
  event: string;
  handler: Node;
}

/**
 * `html.find(SEL).<event>(H)` or `html.find(SEL).on('<event>', H)` → the parts,
 * or `null` when the statement is not a jQuery binding this can translate.
 */
function boundEvent(expr: Expression, htmlParam: string): Bound | null {
  if (expr.type !== 'CallExpression') return null;
  if (expr.callee.type !== 'MemberExpression' || expr.callee.property.type !== 'Identifier') {
    return null;
  }
  const receiver = expr.callee.object;
  if (receiver.type === 'Super') return null;
  const selector = findSelector(receiver, htmlParam);
  if (selector === null) return null;

  const calleeName = expr.callee.property.name;
  if (EVENTS.has(calleeName)) {
    const handler = expr.arguments[0];
    return handler ? { selector, event: calleeName, handler } : null;
  }
  if (calleeName === 'on' && expr.arguments.length === 2) {
    const first = expr.arguments[0];
    const handler = expr.arguments[1];
    if (first?.type === 'StringLiteral' && handler) {
      return { selector, event: first.value, handler };
    }
  }
  return null;
}

export function extractListeners(cls: SheetClass, source: string): Listeners {
  const out: Listeners = { actions: [], listeners: [], leftovers: [], htmlParam: 'html' };
  const method = methodOf(cls.node, 'activateListeners');
  if (!method) return out;
  const p = method.params[0];
  const htmlParam = p?.type === 'Identifier' ? p.name : 'html';
  out.htmlParam = htmlParam;
  const taken = new Set<string>();

  const leftover = (stmt: Statement): void => {
    out.leftovers.push({ line: stmt.loc?.start.line ?? 0, text: text(source, stmt) });
  };

  const consider = (stmt: Statement): void => {
    if (stmt.type !== 'ExpressionStatement') return;
    const e = stmt.expression;
    if (e.type === 'AwaitExpression') return;
    // Anything that is not a method call, and super.activateListeners(html): dropped.
    if (e.type !== 'CallExpression') return;
    if (e.callee.type !== 'MemberExpression' || e.callee.property.type !== 'Identifier') return;
    if (e.callee.object.type === 'Super') return;

    const bound = boundEvent(e, htmlParam);
    if (!bound) {
      leftover(stmt);
      return;
    }
    const { selector, event, handler } = bound;

    if (event !== 'click') {
      out.listeners.push({ selector, event, handlerText: text(source, handler) });
      return;
    }

    const name = actionName(selector, taken);
    if (name === null) {
      leftover(stmt);
      return;
    }
    const forwarded = forwardedMethod(handler);
    if (forwarded) {
      out.actions.push({
        name,
        selector,
        kind: 'method',
        method: forwarded,
        param: null,
        body: null,
        isAsync: false,
      });
      return;
    }
    if (handler.type === 'ArrowFunctionExpression' || handler.type === 'FunctionExpression') {
      const p0 = handler.params[0];
      out.actions.push({
        name,
        selector,
        kind: 'inline',
        method: null,
        param: p0?.type === 'Identifier' ? p0.name : null,
        body: text(source, handler.body),
        isAsync: Boolean(handler.async),
      });
      return;
    }
    leftover(stmt);
  };

  /** A guard such as `if (!this.options.editable) return;`: V2 sheets gate through isEditable. */
  const isGuard = (stmt: Statement): boolean => {
    if (stmt.type !== 'IfStatement' || stmt.alternate) return false;
    const c = stmt.consequent;
    if (c.type === 'ReturnStatement') return true;
    return (
      c.type === 'BlockStatement' && c.body.length === 1 && c.body[0]?.type === 'ReturnStatement'
    );
  };

  const visit = (stmts: Statement[]): void => {
    for (const stmt of stmts) {
      if (isGuard(stmt)) continue;
      if (stmt.type === 'IfStatement') {
        // Bindings under a condition are still bindings; the condition itself is lost, so say so.
        const branches = [stmt.consequent, stmt.alternate].filter((b): b is Statement =>
          Boolean(b),
        );
        for (const b of branches) visit(b.type === 'BlockStatement' ? b.body : [b]);
        out.leftovers.push({
          line: stmt.loc?.start.line ?? 0,
          text: `if (${text(source, stmt.test)}) guarded the bindings above it; V2 actions run regardless, gate inside the handler`,
        });
        continue;
      }
      if (stmt.type === 'BlockStatement') {
        visit(stmt.body);
        continue;
      }
      consider(stmt);
    }
  };
  visit(method.body.body);
  return out;
}
