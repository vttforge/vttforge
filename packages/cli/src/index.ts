/**
 * @vttforge/cli — public library exports.
 *
 * The CLI is intended to be used as a bin (`vttforge` command). These
 * exports exist for consumers who want to programmatically invoke the
 * scaffolder (e.g. from another CLI, a test harness, or a custom tool).
 */

export type { InitOptions, ResolvedInitOptions, TemplateVariant } from './commands/init.js';
export { runInit, ScaffoldError } from './commands/init.js';
export type { PackageManager } from './package-manager.js';
export { detectPackageManager, installCommand } from './package-manager.js';
export type { ScaffoldOptions, ScaffoldVars } from './scaffold.js';
export { scaffold, substitute, templatesRoot } from './scaffold.js';

export const VTTFORGE_CLI_VERSION = '0.1.0';
