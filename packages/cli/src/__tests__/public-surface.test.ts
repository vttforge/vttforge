/**
 * The public surface, held to the classification in apps/docs/stability.md.
 *
 * This package's product is the `vttforge` binary, and its index grew to
 * re-export the pieces the commands are built from. The classification only
 * means something if a new export cannot slip in unclassified, which is what
 * this test is for: add an export and it fails until you decide which of the
 * three groups it belongs to.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const INDEX = join(dirname(fileURLToPath(import.meta.url)), '..', 'index.ts');

/**
 * Supported: covered by the deprecation policy.
 *
 * `runInit` is what `create-vttforge` calls. The audit entries are the
 * extension point: a project writes its own `RuleFn` and hands it to the same
 * reporter the CLI uses.
 */
const SUPPORTED = new Set([
  'runInit',
  'ScaffoldError',
  'runAudit',
  'runManifestRules',
  'runSourceRules',
  'formatReport',
  'SEVERITY_RANK',
  'VTTFORGE_CLI_VERSION',
]);

/** Plausibly useful, unproven, and tagged `@experimental` at its definition. */
const EXPERIMENTAL = new Set([
  'emitReleaseZip',
  'runBuild',
  'runDev',
  'runAuditCommand',
  'readManifest',
  'emitZip',
]);

/**
 * Removed in 0.8.0. Kept here so the guard below can prove they stay out: the
 * index test asserts absence, this one asserts nobody re-adds them to a group.
 */
const REMOVED = new Set<string>([]);

/**
 * The value exports the index re-exports.
 *
 * Types are left out on purpose: every one of them is reachable through some
 * value's signature, so they carry whatever that value promises.
 */
function exportedValues(): string[] {
  const source = readFileSync(INDEX, 'utf8');
  const names: string[] = [];

  for (const match of source.matchAll(/export\s*\{([^}]*)\}\s*from/g)) {
    for (const raw of (match[1] ?? '').split(',')) {
      const entry = raw.trim();
      // `export type { … }` blocks and inline `type X` entries are types.
      if (entry === '' || entry.startsWith('type ')) continue;
      names.push(entry.split(/\s+as\s+/).pop() ?? entry);
    }
  }
  for (const match of source.matchAll(/^export const (\w+)/gm)) {
    if (match[1]) names.push(match[1]);
  }
  return [...new Set(names)];
}

describe('the CLI public surface', () => {
  it('classifies every exported value', () => {
    const unclassified = exportedValues().filter(
      (name) => !SUPPORTED.has(name) && !EXPERIMENTAL.has(name) && !REMOVED.has(name),
    );

    expect(
      unclassified,
      'new exports here need a group in apps/docs/stability.md, and an @experimental or @internal tag at the definition unless they are supported',
    ).toEqual([]);
  });

  it('does not claim to classify exports that are gone', () => {
    const live = new Set(exportedValues());
    const stale = [...SUPPORTED, ...EXPERIMENTAL, ...REMOVED].filter((n) => !live.has(n));

    expect(stale, 'these are classified but no longer exported; drop them from the lists').toEqual(
      [],
    );
  });

  it('tags every experimental export at its definition', () => {
    // The tag has to live on the declaration, not on the re-export line:
    // the bundler drops re-export comments, so only the definition's comment
    // reaches the published `.d.mts` and the consumer's editor.
    const source = readFileSync(INDEX, 'utf8');
    const files = [...source.matchAll(/from '(\.[^']+)\.js'/g)].map((m) => m[1]);
    const bodies = new Map<string, string>();
    for (const rel of files) {
      if (rel === undefined) continue;
      const path = join(dirname(INDEX), `${rel}.ts`);
      try {
        bodies.set(rel, readFileSync(path, 'utf8'));
      } catch {
        // A path that does not resolve is caught by the typecheck, not here.
      }
    }
    const all = [...bodies.values()].join('\n');

    const untagged: string[] = [];
    for (const [name, tag] of [...[...EXPERIMENTAL].map((n) => [n, '@experimental'] as const)]) {
      const decl = new RegExp(
        `/\\*\\*(?:[^*]|\\*(?!/))*?${tag}(?:[^*]|\\*(?!/))*?\\*/\\s*export (?:async )?(?:function|const|class) ${name}\\b`,
      );
      if (!decl.test(all)) untagged.push(`${name} (${tag})`);
    }

    expect(untagged, 'tag these at the definition so the tag reaches the published types').toEqual(
      [],
    );
  });
});
