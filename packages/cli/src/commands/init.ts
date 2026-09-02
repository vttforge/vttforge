/**
 * `vttforge init`: interactive scaffolder.
 *
 * Honors CLI flags first, prompts for everything missing, then copies the
 * matching template into the destination directory. Optionally `git init`s
 * and runs the detected package manager's install command at the end.
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import * as p from '@clack/prompts';
import { initGitRepo, readGitAuthorName } from '../git.js';
import { detectPackageManager, installCommand } from '../package-manager.js';
import { type ScaffoldVars, scaffold, templatesRoot } from '../scaffold.js';

export interface InitOptions {
  name?: string;
  type?: 'system' | 'module';
  lang?: 'ts' | 'js';
  /** Manifest id. Defaults to a slug of the directory name. */
  id?: string;
  /** Human-readable title shown in Foundry's setup screens. */
  title?: string;
  /** One-line description for the manifest. */
  description?: string;
  /** Author name for the manifest. Defaults to the local git author. */
  author?: string;
  /** SPDX license id written to package.json. */
  license?: string;
  /**
   * Take the default for anything not supplied instead of asking.
   *
   * Required to scaffold without a terminal: a prompt with nothing to read
   * from waits forever, which is no way to fail.
   */
  yes?: boolean;
  noInstall?: boolean;
  noGit?: boolean;
  /** Override the working directory (test hook). Defaults to `process.cwd()`. */
  cwd?: string;
}

export interface ResolvedInitOptions
  extends Required<
    Omit<InitOptions, 'cwd' | 'id' | 'title' | 'description' | 'author' | 'license' | 'yes'>
  > {
  cwd: string;
  dest: string;
  id: string;
  title: string;
  description: string;
  author: string;
  license: string;
  foundryMinVersion: string;
  foundryVerifiedVersion: string;
  templateVariant: TemplateVariant;
}

export type TemplateVariant = 'system-ts' | 'system-js' | 'module-ts' | 'module-js';

const PACKAGE_ID_RE = /^[a-z][a-z0-9-]*$/;
const UNSAFE_METADATA_CHARS_RE = /["\\\r\n\t]/;

// Clack hands validators `string | undefined`; the prompt calls them before
// anything is typed. Blank metadata is allowed here; only the `Required`
// variant below rejects it.
export function validateMetadata(value: string | undefined): string | undefined {
  if (!value) return undefined;
  // Reject characters that would break JSON string contexts in the
  // generated manifests/i18n catalogues. Apostrophes are fine: every JS
  // string literal in the templates is double-quoted, every JSON value is
  // double-quoted. Backslashes and double quotes need explicit escaping
  // we don't perform during substitution, so we reject them at the
  // prompt instead of producing broken scaffolds.
  if (UNSAFE_METADATA_CHARS_RE.test(value)) {
    return 'Avoid backslashes, double quotes, and line breaks; they break the generated manifest.';
  }
  // Reject `*/` because metadata is interpolated into JS/CSS block-comment
  // headers in the generated files; a stray comment terminator there
  // closes the header early and leaves trailing source garbage.
  if (value.includes('*/')) {
    return 'Avoid `*/`; it closes block comments in the generated source headers.';
  }
  return undefined;
}

export function validateRequiredMetadata(value: string | undefined): string | undefined {
  if (!value || value.trim().length === 0) {
    return 'Required: Foundry rejects packages with a blank title.';
  }
  return validateMetadata(value);
}

export function validatePackageId(value: string | undefined): string | undefined {
  // Coalesce before the test. `PACKAGE_ID_RE.test(undefined)` coerces to the
  // string "undefined", which matches the pattern and would let a missing id
  // through.
  if (!PACKAGE_ID_RE.test(value ?? '')) {
    return 'Package id must start with a letter and contain only lowercase letters, digits, dashes';
  }
  return undefined;
}

/**
 * Thrown when the scaffolder cannot continue: bad input, an existing
 * destination, a cancelled prompt, etc. `runInit` propagates these instead
 * of calling `process.exit`, so library consumers (tests, other CLIs) can
 * catch and recover. The `vttforge` bin wraps `runInit` in a top-level
 * handler that prints the message and exits with code 1.
 */
export class ScaffoldError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScaffoldError';
  }
}

function isCancelled(value: unknown): boolean {
  return p.isCancel(value);
}

function bail(message: string): never {
  p.cancel(message);
  throw new ScaffoldError(message);
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function localePrefix(id: string): string {
  return id.toUpperCase().replace(/-/g, '_');
}

function titleCase(input: string): string {
  return input
    .split(/[-_\s]+/)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/**
 * Whether we may ask the user anything at all.
 *
 * Clack reads from stdin. With no terminal attached there is nothing to read,
 * and the prompt simply hangs. So a run that cannot ask has to be told every
 * answer up front, or be given `--yes` and take the defaults.
 */
function canPrompt(yes: boolean | undefined): boolean {
  return yes !== true && Boolean(process.stdin.isTTY);
}

function templateVariantFor(type: 'system' | 'module', lang: 'ts' | 'js'): TemplateVariant {
  return `${type}-${lang}` as TemplateVariant;
}

export async function runInit(options: InitOptions = {}): Promise<void> {
  const cwd = options.cwd ?? process.cwd();
  const interactive = canPrompt(options.yes);
  p.intro('🜲 vttforge init: scaffold a Foundry v13+ system or module');

  // --- name ------------------------------------------------------------------
  let name = options.name?.trim();
  if (!name && !interactive) {
    bail(
      'A directory name is required when running without prompts. Pass it as the first argument: `vttforge init my-module --yes`.',
    );
  }
  if (!name) {
    const answer = await p.text({
      message: 'Directory name (also the default manifest id)',
      placeholder: 'my-system',
      validate: (value: string | undefined) => {
        const trimmed = value?.trim() ?? '';
        if (trimmed.length === 0) return 'Name is required';
        if (!PACKAGE_ID_RE.test(trimmed)) {
          return 'Use only lowercase letters, digits, and dashes (no spaces, slashes, dots).';
        }
        return undefined;
      },
    });
    if (isCancelled(answer)) bail('Scaffold cancelled.');
    name = String(answer).trim();
  } else if (!PACKAGE_ID_RE.test(name)) {
    bail(
      `Invalid name "${name}": use only lowercase letters, digits, and dashes (no spaces, slashes, dots).`,
    );
  }
  const dest = resolve(cwd, name);
  if (existsSync(dest)) {
    bail(`Directory already exists: ${dest}`);
  }

  // --- type ------------------------------------------------------------------
  let type = options.type;
  if (type !== 'system' && type !== 'module' && !interactive) {
    type = 'system';
  }
  if (type !== 'system' && type !== 'module') {
    const answer = await p.select({
      message: 'What are you building?',
      options: [
        { value: 'system', label: 'system: defines the game rules (Actor/Item types, sheets)' },
        {
          value: 'module',
          label: 'module: extends an existing system or adds cross-system features',
        },
      ],
      initialValue: 'system',
    });
    if (isCancelled(answer)) bail('Scaffold cancelled.');
    type = answer as 'system' | 'module';
  }

  // --- lang ------------------------------------------------------------------
  let lang = options.lang;
  if (lang !== 'ts' && lang !== 'js' && !interactive) {
    lang = 'ts';
  }
  if (lang !== 'ts' && lang !== 'js') {
    const answer = await p.select({
      message: 'Language',
      options: [
        { value: 'ts', label: 'TypeScript' },
        { value: 'js', label: 'JavaScript (.mjs)' },
      ],
      initialValue: 'ts',
    });
    if (isCancelled(answer)) bail('Scaffold cancelled.');
    lang = answer as 'ts' | 'js';
  }

  // --- id / title / description / author ------------------------------------
  /**
   * Resolve one metadata field: an explicit flag wins, otherwise ask, and
   * when asking is impossible take the default.
   */
  const resolveField = async (
    provided: string | undefined,
    fallback: string,
    ask: () => Promise<unknown>,
    validate: (value: string) => string | undefined,
  ): Promise<string> => {
    if (provided !== undefined) {
      const trimmed = provided.trim();
      const failure = validate(trimmed);
      if (failure !== undefined) bail(`${failure} (got ${JSON.stringify(provided)})`);
      return trimmed;
    }
    if (!interactive) return fallback;
    const answer = await ask();
    if (isCancelled(answer)) bail('Scaffold cancelled.');
    const value = String(answer).trim();
    return value.length > 0 ? value : fallback;
  };

  const defaultId = slugify(name);
  const id = await resolveField(
    options.id,
    defaultId,
    () =>
      p.text({
        message: 'Package id (used as the folder Foundry serves under /<systems|modules>/<id>/)',
        initialValue: defaultId,
        validate: validatePackageId,
      }),
    validatePackageId,
  );

  const title = await resolveField(
    options.title,
    titleCase(id),
    () =>
      p.text({
        message: 'Title (human-readable, shown in Foundry setup screens)',
        initialValue: titleCase(id),
        validate: validateRequiredMetadata,
      }),
    validateRequiredMetadata,
  );

  const defaultDescription = `A Foundry v13+ ${type} built with VTTForge`;
  const description = await resolveField(
    options.description,
    defaultDescription,
    () =>
      p.text({
        message: 'One-line description',
        placeholder: defaultDescription,
        initialValue: defaultDescription,
        validate: validateMetadata,
      }),
    validateMetadata,
  );

  const rawDetectedAuthor = await readGitAuthorName();
  // The git fallback bypasses Clack validation, so apply the same metadata
  // safety check before letting it through. If the local git config has
  // something we'd reject from a prompt, drop the suggestion and let the
  // user type a clean value (or land on the 'Anonymous' default).
  const detectedAuthor =
    rawDetectedAuthor && validateMetadata(rawDetectedAuthor) === undefined
      ? rawDetectedAuthor
      : undefined;
  const author = await resolveField(
    options.author,
    detectedAuthor ?? 'Anonymous',
    () =>
      p.text({
        message: 'Author name (used in the manifest)',
        placeholder: detectedAuthor ?? 'Your Name',
        initialValue: detectedAuthor ?? '',
        validate: validateMetadata,
      }),
    validateMetadata,
  );

  const license = await resolveField(
    options.license,
    'MIT',
    () =>
      p.select({
        message: 'License',
        options: [
          { value: 'MIT', label: 'MIT (recommended for Foundry community packages)' },
          { value: 'Apache-2.0', label: 'Apache-2.0' },
          { value: 'GPL-3.0-or-later', label: 'GPL-3.0-or-later' },
          { value: 'UNLICENSED', label: 'UNLICENSED (private use only)' },
        ],
        initialValue: 'MIT',
      }),
    validateRequiredMetadata,
  );

  const foundryMinVersion = '13';
  const foundryVerifiedVersion = '13.341';

  // --- scaffold --------------------------------------------------------------
  const templateVariant = templateVariantFor(type, lang);
  const templateDir = resolve(templatesRoot(), templateVariant);
  if (!existsSync(templateDir)) {
    bail(`Template "${templateVariant}" not found at ${templateDir}`);
  }

  const vars: ScaffoldVars = {
    ID: id,
    TITLE: title,
    DESCRIPTION: description,
    AUTHOR: author,
    LICENSE: license,
    FOUNDRY_MIN_VERSION: foundryMinVersion,
    FOUNDRY_VERIFIED_VERSION: foundryVerifiedVersion,
    LOCALE_PREFIX: localePrefix(id),
    YEAR: String(new Date().getFullYear()),
  };

  const scaffoldSpinner = p.spinner();
  scaffoldSpinner.start(`Scaffolding ${templateVariant} into ${name}/`);
  try {
    await scaffold({ templateDir, destDir: dest, vars });
    scaffoldSpinner.stop(`Scaffold written to ${dest}`);
  } catch (err) {
    scaffoldSpinner.stop('Scaffold failed.');
    throw err;
  }

  // --- install ---------------------------------------------------------------
  // Install runs BEFORE git init so the lockfile lands in the initial commit
  // Generated repos that ship with a lockfile install reproducibly and
  // the working tree stays clean after scaffold.
  const pm = detectPackageManager();
  let shouldInstall = !options.noInstall;
  if (shouldInstall && interactive) {
    const confirm = await p.confirm({
      message: `Install dependencies now with ${pm}?`,
      initialValue: true,
    });
    if (isCancelled(confirm))
      bail('Scaffold cancelled at install prompt (your scaffold is intact).');
    shouldInstall = confirm === true;
  }

  if (shouldInstall) {
    const installSpinner = p.spinner();
    installSpinner.start(`Running ${installCommand(pm)}`);
    try {
      await runInstall(pm, dest);
      installSpinner.stop(`Dependencies installed (${pm}).`);
    } catch (err) {
      installSpinner.stop(`Install failed: ${err instanceof Error ? err.message : String(err)}`);
      p.note(
        `Run \`${installCommand(pm)}\` inside ${name}/ to retry.`,
        'Continuing without install.',
      );
    }
  }

  // --- git -------------------------------------------------------------------
  // Runs AFTER install so the resulting lockfile is captured by the first
  // commit and the working tree stays clean.
  if (!options.noGit) {
    const gitSpinner = p.spinner();
    gitSpinner.start('Initializing git repository');
    const gitResult = await initGitRepo(dest);
    if (gitResult.ok) {
      gitSpinner.stop('Git initialized (branch: main, initial commit landed).');
    } else {
      gitSpinner.stop(`Skipped git init: ${gitResult.reason ?? 'unknown error'}`);
    }
  }

  // --- outro -----------------------------------------------------------------
  const nextSteps = [
    `cd ${name}`,
    !shouldInstall ? installCommand(pm) : null,
    `${pm} run build`,
    'Symlink dist/ into your Foundry Data/<systems|modules>/<id>/ (or use the dev compose mount)',
  ]
    .filter((line): line is string => line !== null)
    .map((line, idx) => `  ${idx + 1}. ${line}`)
    .join('\n');
  p.note(nextSteps, 'Next steps');
  p.outro('Have fun building.');
}

function runInstall(pm: string, cwd: string): Promise<void> {
  return new Promise((resolveInstall, rejectInstall) => {
    const child = spawn(pm, ['install'], {
      cwd,
      stdio: 'inherit',
      env: process.env,
    });
    child.on('error', rejectInstall);
    child.on('exit', (code) => {
      if (code === 0) resolveInstall();
      else rejectInstall(new Error(`${pm} install exited with code ${code}`));
    });
  });
}
