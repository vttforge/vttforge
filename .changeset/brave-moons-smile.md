---
'@vttforge/cli': minor
---

**Breaking.** Removes 23 internal exports from the package index.

Every package here is below `1.0.0`, where a minor may break you. This one does.

The product here is the `vttforge` binary. Its index had grown to re-export the pieces the commands are built from, and 33 of 60 exports were reachable only by importing them by name. The previous release tagged them `@internal`; this one removes them.

Gone: `scaffold`, `substitute`, `templatesRoot`, `createLink`, `readLinkTarget`, `removeLink`, `setupDevSymlink`, `cleanupDevSymlink`, `resolveViteInvocation`, `runViteBuildOnce`, `spawnViteWatch`, `ViteNotInstalledError`, `detectPackageManager`, `detectProjectPackageManager`, `execInvocation`, `installCommand`, `autoDetectFoundryDataDir`, `configPath`, `foundryPackagesDir`, `looksLikeFoundryDataDir`, `resolveFoundryDataDir`, `loadConfig`, `saveConfig`, and the types that existed only for them (`ScaffoldOptions`, `ScaffoldVars`, `CreateLinkOptions`, `PackageManager`, `ResolveDataDirOptions`, `VTTForgeConfig`).

What remains is what the package is for:

- `runInit` and `ScaffoldError`, which is what `create-vttforge` calls.
- The audit surface: `runAudit`, `runManifestRules`, `runSourceRules`, `formatReport`, `SEVERITY_RANK`, and the `RuleFn` / `RuleResult` / `Severity` / `AuditReport` types. Write your own rule and hand it to the same reporter the CLI uses.
- `runDev`, `runBuild`, `emitReleaseZip`, `emitZip` and `readManifest`, still `@experimental`.

Every removed export was checked: nothing outside this package imported any of them. If one of these was your only way to do something, open an issue and it comes back as a supported export rather than a leak.

Use the `vttforge` command for everything else.
