/**
 * Detect which package manager invoked the CLI so we can run the right
 * `install` command after scaffolding.
 *
 * Strategy: read `npm_config_user_agent`, which pnpm/npm/bun/yarn all set when
 * they spawn a child process (including `pnpm dlx`, `pnpm create`, etc.).
 * Falls back to `pnpm` because that's the VTTForge house default and the
 * most common Foundry-developer choice — but any concrete signal in the
 * environment wins over the default.
 */
export type PackageManager = 'pnpm' | 'npm' | 'bun' | 'yarn';

export function detectPackageManager(env: NodeJS.ProcessEnv = process.env): PackageManager {
  const ua = env.npm_config_user_agent;
  if (typeof ua === 'string' && ua.length > 0) {
    if (ua.startsWith('pnpm')) return 'pnpm';
    if (ua.startsWith('bun')) return 'bun';
    if (ua.startsWith('yarn')) return 'yarn';
    if (ua.startsWith('npm')) return 'npm';
  }
  return 'pnpm';
}

export function installCommand(pm: PackageManager): string {
  return `${pm} install`;
}
