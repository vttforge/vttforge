/**
 * @vttforge/cli: public library exports.
 *
 * The product here is the `vttforge` binary. These exports exist so another
 * tool can drive the same work without shelling out, and they fall into three
 * groups, marked per export below.
 *
 * **Supported.** `runInit` and the audit surface. `create-vttforge` calls
 * `runInit`, and the audit rules are a documented extension point: a project
 * can write its own `RuleFn` and hand it to the same reporter the CLI uses.
 * These follow the deprecation policy.
 *
 * **`@experimental`.** Plausibly useful to a tool author, but no consumer has
 * ever asked for them, so the shape is a guess. They can change in a minor.
 *
 * **`@internal`.** Implementation detail of the binary that reached the index
 * by accident. Nothing outside this package imports them. They are staying
 * only until the next major, and importing one is not supported today.
 *
 * See apps/docs/stability.md for what each tag promises.
 */

import { version } from '../package.json' with { type: 'json' };

/** Supported: run every audit rule over a project root. */
export { type RunAuditOptions, runAudit } from './audit/index.js';
export { runManifestRules } from './audit/manifest-rules.js';
export type { ReportFormat } from './audit/reporter.js';
export { formatReport } from './audit/reporter.js';
export { runSourceRules } from './audit/source-rules.js';
export type { AuditReport, RuleFn, RuleResult, Severity } from './audit/types.js';
export { SEVERITY_RANK } from './audit/types.js';
export type { AuditOptions, AuditResult } from './commands/audit.js';
/** @experimental The command wrapper. Prefer `runAudit` plus `formatReport`. */
export { runAuditCommand } from './commands/audit.js';
export type { BuildOptions } from './commands/build.js';
/** @experimental Shape is a guess; no consumer has asked for it yet. */
export { emitReleaseZip, runBuild } from './commands/build.js';
export type { DevOptions } from './commands/dev.js';
/** @experimental Shape is unproven; `vttforge dev` is the supported way in. */
export { runDev } from './commands/dev.js';
export type { InitOptions, ResolvedInitOptions, TemplateVariant } from './commands/init.js';
/** Supported: scaffold a project. This is what `create-vttforge` calls. */
export { runInit, ScaffoldError } from './commands/init.js';
export type { FoundryManifest, PackageType } from './manifest.js';
/** @experimental Reads `system.json` / `module.json`. Useful, unproven. */
export { readManifest } from './manifest.js';
export type { EmitZipOptions, EmitZipResult } from './zip.js';
/** @experimental Lower level than `emitReleaseZip`. */
export { emitZip } from './zip.js';

export const VTTFORGE_CLI_VERSION: string = version;
