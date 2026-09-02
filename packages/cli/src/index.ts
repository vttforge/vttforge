/**
 * @vttforge/cli: public library exports.
 *
 * The CLI is intended to be used as a bin (`vttforge` command). These
 * exports exist for consumers who want to programmatically invoke the
 * scaffolder (e.g. from another CLI, a test harness, or a custom tool).
 */

import { version } from '../package.json' with { type: 'json' };

export { type RunAuditOptions, runAudit } from './audit/index.js';
export { runManifestRules } from './audit/manifest-rules.js';
export type { ReportFormat } from './audit/reporter.js';
export { formatReport } from './audit/reporter.js';
export { runSourceRules } from './audit/source-rules.js';
export type { AuditReport, RuleFn, RuleResult, Severity } from './audit/types.js';
export { SEVERITY_RANK } from './audit/types.js';
export type { AuditOptions, AuditResult } from './commands/audit.js';
export { runAuditCommand } from './commands/audit.js';
export type { BuildOptions } from './commands/build.js';
export { emitReleaseZip, runBuild } from './commands/build.js';
export type { DevOptions } from './commands/dev.js';
export { cleanupDevSymlink, runDev, setupDevSymlink } from './commands/dev.js';
export type { InitOptions, ResolvedInitOptions, TemplateVariant } from './commands/init.js';
export { runInit, ScaffoldError } from './commands/init.js';
export type { ResolveDataDirOptions, VTTForgeConfig } from './foundry-data-dir.js';
export {
  autoDetectFoundryDataDir,
  configPath,
  foundryPackagesDir,
  loadConfig,
  looksLikeFoundryDataDir,
  resolveFoundryDataDir,
  saveConfig,
} from './foundry-data-dir.js';
export type { FoundryManifest, PackageType } from './manifest.js';
export { readManifest } from './manifest.js';
export type { PackageManager } from './package-manager.js';
export {
  detectPackageManager,
  detectProjectPackageManager,
  execInvocation,
  installCommand,
} from './package-manager.js';
export type { ScaffoldOptions, ScaffoldVars } from './scaffold.js';
export { scaffold, substitute, templatesRoot } from './scaffold.js';
export type { CreateLinkOptions } from './symlink.js';
export { createLink, readLinkTarget, removeLink } from './symlink.js';
export {
  resolveViteInvocation,
  runViteBuildOnce,
  spawnViteWatch,
  ViteNotInstalledError,
} from './vite-runner.js';
export type { EmitZipOptions, EmitZipResult } from './zip.js';
export { emitZip } from './zip.js';

export const VTTFORGE_CLI_VERSION: string = version;
