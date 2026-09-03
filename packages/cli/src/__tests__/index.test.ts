/**
 * What this package offers a program, and what it deliberately does not.
 *
 * The product is the `vttforge` binary. The index used to re-export the pieces
 * the commands are built from, which meant 33 of 60 exports were reachable
 * only by importing them by name. Those are gone. This holds both halves of
 * that: the surface that remains, and the internals that must not come back.
 */
import { describe, expect, it } from 'vitest';
import cliPackage from '../../package.json' with { type: 'json' };
import * as api from '../index.js';
import {
  emitReleaseZip,
  emitZip,
  formatReport,
  readManifest,
  runAudit,
  runBuild,
  runDev,
  runInit,
  runManifestRules,
  runSourceRules,
  ScaffoldError,
  SEVERITY_RANK,
  VTTFORGE_CLI_VERSION,
} from '../index.js';

describe('@vttforge/cli public surface', () => {
  it('offers the two supported entry points', () => {
    // `create-vttforge` calls runInit; everything else is a convenience.
    expect(typeof runInit).toBe('function');
    expect(typeof ScaffoldError).toBe('function');
  });

  it('offers the audit surface, which is the extension point', () => {
    // A project writes its own RuleFn and hands the results to the same
    // reporter the CLI uses.
    expect(typeof runAudit).toBe('function');
    expect(typeof runManifestRules).toBe('function');
    expect(typeof runSourceRules).toBe('function');
    expect(typeof formatReport).toBe('function');
    expect(SEVERITY_RANK).toMatchObject({ HIGH: 0, MEDIUM: 1, LOW: 2 });
  });

  it('offers the experimental command wrappers', () => {
    expect(typeof runDev).toBe('function');
    expect(typeof runBuild).toBe('function');
    expect(typeof emitReleaseZip).toBe('function');
    expect(typeof emitZip).toBe('function');
    expect(typeof readManifest).toBe('function');
  });

  it('exports the version constant', () => {
    expect(VTTFORGE_CLI_VERSION).toBe(cliPackage.version);
  });

  it('keeps the binary’s internals out of the index', () => {
    // Every one of these was exported before 0.8.0 and nothing outside this
    // package imported them. If one reappears here it is a regression, not a
    // feature: reach for the `vttforge` command instead.
    const gone = [
      'scaffold',
      'substitute',
      'templatesRoot',
      'createLink',
      'readLinkTarget',
      'removeLink',
      'setupDevSymlink',
      'cleanupDevSymlink',
      'resolveViteInvocation',
      'runViteBuildOnce',
      'spawnViteWatch',
      'ViteNotInstalledError',
      'detectPackageManager',
      'detectProjectPackageManager',
      'execInvocation',
      'installCommand',
      'autoDetectFoundryDataDir',
      'configPath',
      'foundryPackagesDir',
      'looksLikeFoundryDataDir',
      'resolveFoundryDataDir',
      'loadConfig',
      'saveConfig',
    ];

    expect(gone.filter((name) => name in api)).toEqual([]);
  });
});
