/**
 * The template side of `migrate --sheets`: attribute insertions on opening
 * tags, nothing else. A V2 sheet finds its handlers by `data-action`, and the
 * SDK's tab action by `data-action="vttforgeTab"` plus `data-group` on the
 * links and the panes. Handlebars blocks and expressions are left alone; only
 * literal `class` / `id` / `data-tab` attributes are matched, and a tab id
 * that is an expression is skipped when reading the ids.
 */

export interface TemplateEdit {
  line: number;
  before: string;
  after: string;
}

export interface TemplateResult {
  output: string;
  edits: TemplateEdit[];
  formRoot: boolean;
}

/**
 * One opening tag: the name, the attribute run, and the self-closing slash.
 * Exactly three capture groups — `editTemplate` reads the replacer's `offset`
 * as the fourth argument, so a fourth group would shift every reported line.
 * A fresh regex per call: a shared global one carries `lastIndex` between
 * `readTabIds`, `elementRange` and `String#replace`.
 */
// An opening tag: the name, then attributes and Handlebars mustaches (`{{#if x}}disabled{{/if}}`
// sits inside a tag as an opaque token), then an optional self-closing slash.
const tagRe = () =>
  /<([a-zA-Z][\w-]*)((?:\s*\{\{[^{}]*\}\}|\s+[^\s=>/{]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?|(?<=\}\})[^\s=>/{]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>/g;

/** The value of one attribute in a tag's attribute run, or null when absent. */
function attr(attrs: string, name: string): string | null {
  const m = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`).exec(attrs);
  return m ? (m[1] ?? m[2] ?? m[3] ?? '') : null;
}

function hasClass(attrs: string, cls: string): boolean {
  return (attr(attrs, 'class') ?? '').split(/\s+/).includes(cls);
}

/** Only `.class` and `#id` selectors match; anything else stays for `_onRender`. */
function matches(attrs: string, selector: string): boolean {
  const m = /^([.#])([A-Za-z_][\w-]*)/.exec(selector.trim());
  if (!m) {
    return false;
  }
  const [, kind = '', name = ''] = m;
  if (!name) {
    return false;
  }
  return kind === '.' ? hasClass(attrs, name) : attr(attrs, 'id') === name;
}

function lineOf(text: string, index: number): number {
  let n = 1;
  for (let i = 0; i < index; i += 1) {
    if (text[i] === '\n') {
      n += 1;
    }
  }
  return n;
}

/**
 * Index range of the first element a selector opens, through its closing tag.
 * Depth-aware on the tag name, so a nested `<div>` inside the match does not
 * end it early.
 */
function elementRange(template: string, selector: string): [number, number] | null {
  for (const m of template.matchAll(tagRe())) {
    const [whole, name, attrs = ''] = m;
    if (m.index === undefined || !name || !matches(attrs, selector)) {
      continue;
    }
    const open = new RegExp(`<${name}\\b`, 'g');
    const close = new RegExp(`</${name}\\s*>`, 'g');
    let depth = 1;
    let pos = m.index + whole.length;
    while (depth > 0) {
      open.lastIndex = pos;
      close.lastIndex = pos;
      const o = open.exec(template);
      const c = close.exec(template);
      if (!c) {
        return [m.index, template.length];
      }
      if (o && o.index < c.index) {
        depth += 1;
        pos = o.index + o[0].length;
      } else {
        depth -= 1;
        pos = c.index + c[0].length;
      }
    }
    return [m.index, pos];
  }
  return null;
}

/**
 * The `data-tab` values under a tabs nav, in document order. A value holding
 * an expression is skipped: its id is only known at render time.
 */
export function readTabIds(template: string, navSelector: string): string[] {
  const range = elementRange(template, navSelector);
  if (!range) {
    return [];
  }
  const nav = template.slice(range[0], range[1]);
  const ids: string[] = [];
  for (const m of nav.matchAll(tagRe())) {
    const id = attr(m[2] ?? '', 'data-tab');
    if (id && !id.includes('{{')) {
      ids.push(id);
    }
  }
  return ids;
}

/**
 * Add the attributes the generated sheet needs, and report each opening tag
 * that changed. Every other byte of the template is left where it was.
 */
export function editTemplate(
  template: string,
  opts: { actions: Array<{ name: string; selector: string }>; navSelectors: string[] },
): TemplateResult {
  const edits: TemplateEdit[] = [];
  const navRanges = opts.navSelectors
    .map((selector) => elementRange(template, selector))
    .filter((range): range is [number, number] => range !== null);
  const inNav = (index: number) => navRanges.some(([start, end]) => index >= start && index < end);

  const output = template.replace(
    tagRe(),
    (whole: string, name: string, attrs: string, selfClose: string, offset: number) => {
      const add: string[] = [];
      const hasAction = attr(attrs, 'data-action') !== null;
      if (!hasAction) {
        for (const action of opts.actions) {
          if (matches(attrs, action.selector)) {
            add.push(`data-action="${action.name}"`);
            break;
          }
        }
      }
      const tab = attr(attrs, 'data-tab');
      const needsGroup = attr(attrs, 'data-group') === null;
      let withClass = attrs;
      const isNavLink = tab !== null && inNav(offset);
      const isPane = tab !== null && !isNavLink && hasClass(attrs, 'tab');
      if (isNavLink) {
        if (!hasAction && !add.some((one) => one.startsWith('data-action='))) {
          add.push('data-action="vttforgeTab"');
        }
        if (needsGroup) {
          add.push('data-group="primary"');
        }
      } else if (isPane && needsGroup) {
        add.push('data-group="primary"');
      }
      // The active tab comes from the context: `{{tabs.<id>.cssClass}}` on the link and the pane.
      if (
        (isNavLink || isPane) &&
        tab !== null &&
        !tab.includes('{{') &&
        !/\{\{\s*tabs\./.test(attrs)
      ) {
        const marker = `{{tabs.${tab}.cssClass}}`;
        withClass = /\sclass\s*=\s*"([^"]*)"/.test(attrs)
          ? attrs.replace(
              /(\sclass\s*=\s*")([^"]*)(")/,
              (_m, open, value, close) => `${open}${value.trimEnd()} ${marker}${close}`,
            )
          : attrs;
        if (withClass === attrs) add.push(`class="${marker}"`);
      }
      if (add.length === 0 && withClass === attrs) {
        return whole;
      }
      const after = `<${name}${withClass.replace(/\s+$/, '')}${add.length > 0 ? ` ${add.join(' ')}` : ''}${selfClose ? ' /' : ''}>`;
      edits.push({ line: lineOf(template, offset), before: whole, after });
      return after;
    },
  );

  return { output, edits, formRoot: /^\s*<form\b/.test(template) };
}
