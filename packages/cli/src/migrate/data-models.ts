/**
 * `template.json` → one data model per type.
 *
 * v14 deprecates `template.json` and removes it in v16; the replacement is a
 * `TypeDataModel` per type registered on `CONFIG.<Document>.dataModels`,
 * with the type names declared under `documentTypes` in the manifest. The
 * shape is already in the template: every default value says what field it
 * is, and every `templates` entry is a fragment several types share. This
 * reads that and writes the classes, so the move is a review of generated
 * code rather than a transcription.
 *
 * What is inferred, and what is guessed:
 * - a number is a `NumberField` (`integer` when the default is one), a
 *   boolean a `BooleanField`, a string a `StringField` (`HTMLField` when the
 *   key reads like rich text: description, biography, notes), an object a
 *   `SchemaField`, an array an `ArrayField` of whatever its first element is
 *   (`ObjectField` when it is empty or holds objects), `null` an
 *   `ObjectField` marked for review.
 * - a `templates` fragment becomes a function returning a partial schema, so
 *   each type's schema spreads the fragments it listed, in the order the
 *   template listed them, then its own keys. Foundry's implicit `base`
 *   template is skipped.
 */

export type EmitStyle = 'plain' | 'sdk';

export interface DataModelFile {
  /** Project-relative path to write. */
  path: string;
  source: string;
}

export interface DataModelPlan {
  files: DataModelFile[];
  /** The `documentTypes` block the manifest needs, per document. */
  documentTypes: Record<string, Record<string, Record<string, unknown>>>;
  /** The registration a system adds in `init`, as source text. */
  registration: string;
  /** Things the reader has to decide. */
  notes: string[];
}

interface DocumentTemplate {
  types?: string[];
  templates?: Record<string, Record<string, unknown>>;
  htmlFields?: string[];
  filePathFields?: string[];
  gmOnlyFields?: string[];
  [type: string]: unknown;
}

const RICH_TEXT_KEYS = /^(description|biography|bio|notes|details|background|text)$/i;

function fieldFor(
  key: string,
  value: unknown,
  path: string,
  notes: string[],
  indent: string,
): string {
  const next = `${indent}  `;
  if (typeof value === 'number') {
    const integer = Number.isInteger(value);
    return `new f.NumberField({ required: true, nullable: false${integer ? ', integer: true' : ''}, initial: ${value} })`;
  }
  if (typeof value === 'boolean') {
    return `new f.BooleanField({ required: true, nullable: false, initial: ${value} })`;
  }
  if (typeof value === 'string') {
    const literal = JSON.stringify(value);
    if (RICH_TEXT_KEYS.test(key))
      return `new f.HTMLField({ required: true, blank: true, initial: ${literal} })`;
    return `new f.StringField({ required: true, blank: true, initial: ${literal} })`;
  }
  if (Array.isArray(value)) {
    const first = value[0];
    if (first === undefined || (typeof first === 'object' && first !== null)) {
      if (first === undefined)
        notes.push(
          `${path}: an empty array in the template; it is an ArrayField of ObjectField. Name the element's shape if it has one.`,
        );
      return 'new f.ArrayField(new f.ObjectField())';
    }
    return `new f.ArrayField(${fieldFor(key, first, `${path}[]`, notes, indent)})`;
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
      notes.push(
        `${path}: an empty object in the template; it is an ObjectField. Give it a SchemaField if it has a shape.`,
      );
      return 'new f.ObjectField()';
    }
    const inner = entries
      .map(([k, v]) => `${next}${safeKey(k)}: ${fieldFor(k, v, `${path}.${k}`, notes, next)},`)
      .join('\n');
    return `new f.SchemaField({\n${inner}\n${indent}})`;
  }
  notes.push(`${path}: null in the template; it is an ObjectField. Pick the real field.`);
  return 'new f.ObjectField()';
}

function safeKey(key: string): string {
  return /^[A-Za-z_$][\w$]*$/.test(key) ? key : JSON.stringify(key);
}

function pascal(name: string): string {
  return name
    .replace(/(^|[^A-Za-z0-9])([a-z0-9])/g, (_m, _s, c: string) => c.toUpperCase())
    .replace(/[^A-Za-z0-9]/g, '');
}

function camel(name: string): string {
  const p = pascal(name);
  return p.charAt(0).toLowerCase() + p.slice(1);
}

function schemaBody(data: Record<string, unknown>, path: string, notes: string[]): string {
  return Object.entries(data)
    .filter(([k]) => k !== 'templates')
    .map(([k, v]) => `    ${safeKey(k)}: ${fieldFor(k, v, `${path}.${k}`, notes, '    ')},`)
    .join('\n');
}

function header(style: EmitStyle): string {
  if (style === 'sdk') return "import { BaseTypeDataModel, fields } from '@vttforge/core';\n";
  return '';
}

function fieldsLine(style: EmitStyle): string {
  return style === 'sdk' ? '  const f = fields();' : '  const f = foundry.data.fields;';
}

export function planDataModels(
  template: Record<string, unknown>,
  {
    style = 'plain',
    lang = 'js',
    dir = 'scripts/data',
  }: { style?: EmitStyle; lang?: 'js' | 'ts'; dir?: string } = {},
): DataModelPlan {
  const ext = lang === 'ts' ? 'ts' : 'mjs';
  const files: DataModelFile[] = [];
  const notes: string[] = [];
  const documentTypes: DataModelPlan['documentTypes'] = {};
  const registrations: string[] = [];

  for (const [document, raw] of Object.entries(template)) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const doc = raw as DocumentTemplate;
    const types = doc.types ?? [];
    const templates = doc.templates ?? {};
    const docDir = `${dir}/${document.toLowerCase()}`;

    // One fragment per template, so the sharing the template expressed is
    // kept, and a type that lists three fragments spreads three functions.
    const fragmentNames = Object.keys(templates);
    if (fragmentNames.length > 0) {
      const fns = fragmentNames
        .map((name) => {
          const body = schemaBody(templates[name] ?? {}, `${document}.templates.${name}`, notes);
          return `/** The \`${name}\` template, as the types that listed it spread it. */\nexport function ${camel(name)}Fields(f) {\n  return {\n${body}\n  };\n}`;
        })
        .join('\n\n');
      const tsHint =
        lang === 'ts'
          ? '// @ts-nocheck: the field constructors are typed by the runtime, not by this file\n'
          : '';
      files.push({
        path: `${docDir}/templates.${ext}`,
        source: `${tsHint}/**\n * The \`templates\` of the old template.json for ${document}, each as a\n * function of the fields bag. A type spreads the ones it listed.\n */\n\n${fns}\n`,
      });
    }

    documentTypes[document] = {};
    const modelNames: string[] = [];
    for (const type of types) {
      const own = (doc[type] ?? {}) as Record<string, unknown>;
      const listed = ((own.templates as string[] | undefined) ?? []).filter((t) => t !== 'base');
      for (const t of listed) {
        if (!(t in templates))
          notes.push(
            `${document}.${type}: lists template "${t}", which template.json does not define; it was skipped.`,
          );
      }
      const spreads = listed
        .filter((t) => t in templates)
        .map((t) => `    ...${camel(t)}Fields(f),`)
        .join('\n');
      const body = schemaBody(own, `${document}.${type}`, notes);
      const className = `${pascal(type)}Data`;
      const importLine = listed.length
        ? `import { ${listed
            .filter((t) => t in templates)
            .map((t) => `${camel(t)}Fields`)
            .join(', ')} } from './templates.${ext === 'ts' ? 'js' : 'mjs'}';\n`
        : '';
      const schemaFn = `${fieldsLine(style)}\n  return {\n${[spreads, body].filter(Boolean).join('\n')}\n  };`;
      const classSource =
        style === 'sdk'
          ? `${header(style)}${importLine}\n/** The \`${type}\` ${document}, as template.json declared it. */\nfunction define${className}Schema() {\n${schemaFn}\n}\n\nexport class ${className} extends BaseTypeDataModel(define${className}Schema) {\n  prepareDerivedData() {\n    // Derived values go here. Nothing here writes to the database.\n  }\n}\n`
          : `${importLine}\n/** The \`${type}\` ${document}, as template.json declared it. */\nexport class ${className} extends foundry.abstract.TypeDataModel {\n  static defineSchema() {\n${schemaFn.replace(/^/gm, '  ')}\n  }\n\n  prepareDerivedData() {\n    // Derived values go here. Nothing here writes to the database.\n  }\n}\n`;
      files.push({ path: `${docDir}/${type}-data.${ext}`, source: classSource });
      const meta: Record<string, unknown> = {};
      const html = (doc.htmlFields ?? []).filter(
        (k) => k in own || listed.some((t) => k in (templates[t] ?? {})),
      );
      if (html.length) meta.htmlFields = html;
      documentTypes[document][type] = meta;
      modelNames.push(`${type}: ${className}`);
      registrations.push(
        `import { ${className} } from './${docDir.replace(/^scripts\//, '')}/${type}-data.${ext === 'ts' ? 'js' : 'mjs'}';`,
      );
    }
    if (types.length) {
      registrations.push(
        style === 'sdk'
          ? `// registerSystem({ ${document === 'Actor' ? 'actorDataModels' : document === 'Item' ? 'itemDataModels' : `${camel(document)}DataModels`}: { ${modelNames.join(', ')} } })`
          : `// Hooks.once('init', () => Object.assign(CONFIG.${document}.dataModels, { ${modelNames.join(', ')} }));`,
      );
    }
  }
  notes.push(
    "When every type has a model, delete template.json: while it exists, Foundry resets each listed type's documentTypes entry on every start.",
  );
  return { files, documentTypes, registration: registrations.join('\n'), notes };
}
