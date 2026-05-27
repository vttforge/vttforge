/**
 * Git helpers for the init scaffolder. Optional: every step degrades to a
 * warning, never throws. The scaffold completes even if git is missing or
 * the user has no global git config — the user can still `git init`
 * themselves later.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * Read `git config user.name` to pre-fill the author prompt. Returns
 * `undefined` if git is missing or the value is unset.
 */
export async function readGitAuthorName(): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync('git', ['config', '--get', 'user.name']);
    const value = stdout.trim();
    return value.length > 0 ? value : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Initialize a fresh git repository in `cwd`, run an initial commit. Errors
 * are swallowed and converted to a return value so the caller can decide
 * whether to warn or move on.
 */
export async function initGitRepo(cwd: string): Promise<{ ok: boolean; reason?: string }> {
  try {
    await execFileAsync('git', ['init', '--initial-branch=main'], { cwd });
    await execFileAsync('git', ['add', '.'], { cwd });
    await execFileAsync('git', ['commit', '-m', 'chore: initial scaffold from @vttforge/cli'], {
      cwd,
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}
