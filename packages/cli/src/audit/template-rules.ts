/**
 * Template-scope audit rules.
 *
 *   VTTF-AUDIT-008 (HIGH): a sheet template that opens its own `<form>`
 *
 * The two rules before this read the manifest and the source. This one reads
 * the Handlebars, because that is where the mistake lives and nothing else
 * looks there.
 */

import { readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { _internal } from './source-rules.js';
import type { RuleResult } from './types.js';

/**
 * The bases that make the application element a form.
 *
 * `BaseActorSheet` and `BaseItemSheet` set `tag: 'form'`, which is what makes
 * `submitOnChange` work at all. `BaseApplication` and `BaseDocumentSheet` do
 * not, and a template of theirs may open a form of its own quite correctly.
 */
const FORM_TAGGED_BASES = /extends\s+(?:[\w.]+\.)?(?:BaseActorSheet|BaseItemSheet)\s*\(/;

/** `template: '.../foo.hbs'`, in a `static PARTS` block or anywhere near one. */
const TEMPLATE_RE = /template:\s*[`'"]([^`'"]*\.hbs)[`'"]/g;

/** A `<form>` start tag, ignoring what a Handlebars comment says about one. */
const FORM_TAG_RE = /<form[\s>]/i;
const HANDLEBARS_COMMENT_RE = /\{\{!--[\s\S]*?--\}\}|\{\{![^}]*\}\}/g;

/**
 * The templates a form-tagged sheet declares, as paths inside the project.
 *
 * A `PARTS` entry names the path Foundry serves it from, like
 * `systems/my-system/templates/actor/sheet.hbs`. On disk the package root is
 * the project root, so the first two segments come off.
 */
function templatesOfFormSheets(source: string): string[] {
  const classes = _internal.findClassRanges(source);
  const out: string[] = [];
  for (const match of source.matchAll(TEMPLATE_RE)) {
    if (match.index === undefined) continue;
    const owner = classes.find((c) => match.index > c.openIdx && match.index < c.endIdx);
    if (!owner) continue;
    // Look at the class header, which is where `extends` is.
    const header = source.slice(Math.max(0, owner.openIdx - 240), owner.openIdx);
    if (!FORM_TAGGED_BASES.test(header)) continue;
    const served = match[1];
    if (served === undefined) continue;
    const parts = served.split('/');
    // `systems/<id>/…` and `modules/<id>/…` both map to the project root.
    const local = parts[0] === 'systems' || parts[0] === 'modules' ? parts.slice(2) : parts;
    if (local.length > 0) out.push(local.join('/'));
  }
  return [...new Set(out)];
}

/**
 * VTTF-AUDIT-008 (HIGH) — a sheet template that opens its own `<form>`.
 *
 * `BaseActorSheet` and `BaseItemSheet` set `tag: 'form'`, so the application
 * element already is one. A `<form>` inside it owns every field inside it,
 * and the submit reads the outer element: `new FormData` on it comes back
 * empty and nothing is written.
 *
 * HIGH because of how it fails. There is no error and no warning. The sheet
 * looks right, accepts what you type, and drops it when the window closes.
 */
export async function runTemplateRules(cwd: string): Promise<RuleResult[]> {
  const templates = new Set<string>();
  for await (const file of _internal.walkSourceFiles(cwd)) {
    let content: string;
    try {
      content = await readFile(file, 'utf8');
    } catch {
      continue;
    }
    for (const template of templatesOfFormSheets(content)) templates.add(template);
  }

  const results: RuleResult[] = [];
  for (const template of [...templates].sort()) {
    const path = join(cwd, template);
    let source: string;
    try {
      source = await readFile(path, 'utf8');
    } catch {
      // A `PARTS` entry naming a file that is not there is a different
      // problem, and Foundry reports that one itself.
      continue;
    }
    const markup = source.replace(HANDLEBARS_COMMENT_RE, '');
    if (!FORM_TAG_RE.test(markup)) continue;

    const lines = markup.split('\n');
    const line = lines.findIndex((text) => FORM_TAG_RE.test(text)) + 1;
    results.push({
      ruleId: 'VTTF-AUDIT-008',
      title: 'Sheet template opens a form the sheet already is',
      severity: 'HIGH',
      filePath: relative(cwd, path) || template,
      line: line > 0 ? line : 1,
      message:
        'This template is rendered by a sheet built on BaseActorSheet or BaseItemSheet, which set `tag: "form"`, so the application element already is a form. A nested form owns the fields inside it, so the submit reads the outer element and finds nothing. Every edit is dropped when the window closes, with no error.',
      remediation:
        'Replace the `<form>` wrapper with a `<div>`, or drop it entirely. The fields belong to the application element, and `submitOnChange` saves them as they change.',
    });
  }
  return results;
}
