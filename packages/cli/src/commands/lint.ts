/**
 * `vttforge lint`: Biome over the project, then the v14 audit.
 *
 * Biome ships as a dependency of this package, so a scaffolded project has
 * a linter and a formatter without installing or configuring one. The
 * config it runs with is `<cli-pkg>/lint/vttforge-biome.json` unless the project
 * has its own `biome.json` / `biome.jsonc` at its root, in which case that
 * one wins and the shipped config is not read at all. A project that wants
 * to tweak a rule copies the shipped file and edits it.
 *
 * `--fix` writes the safe fixes and formats the files; without it the run
 * only reports. The audit runs after Biome either way (`--no-audit` skips
 * it), and the exit code is non-zero when either half fails.
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runAuditCommand } from './audit.js';

export interface LintOptions {
  /** Project root to lint. Defaults to `process.cwd()`. */
  cwd?: string;
  /** Write the safe fixes and format the files. Default false: report only. */
  fix?: boolean;
  /** Run `vttforge audit` after Biome. Default true. */
  audit?: boolean;
  /** Passed to the audit: any finding fails, not only HIGH. Default false. */
  strict?: boolean;
  /** Custom writer for the audit report (tests). Defaults to process.stdout.write. */
  write?: (chunk: string) => void;
}

export interface LintResult {
  /** Exit code of the Biome run. */
  biomeExitCode: number;
  /** Exit code of the audit, or `null` when it was skipped. */
  auditExitCode: 0 | 1 | null;
  /** Non-zero when either half failed. */
  exitCode: number;
  /** The shipped Biome config file in use. `null` means the project's own. */
  configPath: string | null;
}

/**
 * @internal Implementation detail of the `vttforge` binary. Not supported for
 * outside use, and going away in the next major.
 */
export class BiomeNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BiomeNotFoundError';
  }
}

/**
 * The Biome config shipped with the CLI, resolved from the built module.
 *
 * The file is not named `biome.json` on purpose: Biome treats a file with
 * that name as a nested root config and refuses to run, which would break
 * a project (or this monorepo) that holds the CLI inside another
 * Biome-rooted tree. `--config-path` accepts any file path.
 */
export const SHIPPED_CONFIG_NAME = 'vttforge-biome.json';

function shippedConfig(): string {
  const here = fileURLToPath(import.meta.url);
  // dist/bin.mjs → ../ = dist/, ../../ = package root. In tests the file
  // is src/commands/lint.ts, so the same walk must also land at the root.
  const fromDist = resolve(here, '..', '..', 'lint', SHIPPED_CONFIG_NAME);
  if (existsSync(fromDist)) return fromDist;
  return resolve(here, '..', '..', '..', 'lint', SHIPPED_CONFIG_NAME);
}

/** The project's own config wins when it has one. */
function projectConfig(cwd: string): string | null {
  for (const name of ['biome.json', 'biome.jsonc']) {
    const file = join(cwd, name);
    if (existsSync(file)) return file;
  }
  return null;
}

/** The Biome bin shim, resolved from this package's own dependency graph. */
function biomeBin(): string {
  const require = createRequire(import.meta.url);
  try {
    return require.resolve('@biomejs/biome/bin/biome');
  } catch {
    throw new BiomeNotFoundError(
      'Could not resolve @biomejs/biome from @vttforge/cli. Reinstall the CLI (it ships Biome as a dependency).',
    );
  }
}

/** The argv for Biome: `ci .` to report, `check --write .` to fix. */
export function biomeArgs(opts: { fix: boolean; configPath: string | null }): string[] {
  const args = opts.fix ? ['check', '--write', '.'] : ['ci', '.'];
  if (opts.configPath) args.push(`--config-path=${opts.configPath}`);
  return args;
}

function runBiome(cwd: string, args: string[]): Promise<number> {
  const bin = biomeBin();
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, [bin, ...args], {
      cwd,
      stdio: 'inherit',
      env: process.env,
      shell: false,
    });
    child.on('error', rejectRun);
    child.on('exit', (code) => resolveRun(code ?? 1));
  });
}

/**
 * @experimental Shape is unproven: no consumer has asked for this yet. It can
 * change in a minor.
 */
export async function runLintCommand(options: LintOptions = {}): Promise<LintResult> {
  const cwd = resolve(options.cwd ?? process.cwd());
  const fix = options.fix === true;
  const audit = options.audit !== false;

  if (!existsSync(join(cwd, 'package.json'))) {
    throw new Error(
      `No package.json found at ${cwd}. Run \`vttforge lint\` from inside a scaffolded project.`,
    );
  }

  const configPath = projectConfig(cwd) === null ? shippedConfig() : null;
  const biomeExitCode = await runBiome(cwd, biomeArgs({ fix, configPath }));

  let auditExitCode: 0 | 1 | null = null;
  if (audit) {
    const result = await runAuditCommand({
      cwd,
      strict: options.strict === true,
      write: options.write,
    });
    auditExitCode = result.exitCode;
  }

  const exitCode = biomeExitCode !== 0 ? biomeExitCode : (auditExitCode ?? 0);
  return { biomeExitCode, auditExitCode, exitCode, configPath };
}
