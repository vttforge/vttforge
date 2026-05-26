import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import vttforge, { VTTFORGE_VITE_PLUGIN_VERSION, type VttforgeOptions } from '../index';

const FIXTURE_SRC = fileURLToPath(new URL('./fixtures/example-system', import.meta.url));

function createFixtureWorkspace(): string {
  const root = mkdtempSync(resolve(tmpdir(), 'vttforge-vite-plugin-'));
  cpSync(FIXTURE_SRC, root, { recursive: true });
  return root;
}

// biome-ignore lint/suspicious/noExplicitAny: test helpers call Vite plugin hooks with mocked contexts
type AnyFn = (...args: any[]) => any;

async function invokeConfigHook(
  plugin: ReturnType<typeof vttforge>,
  root: string,
  command: 'build' | 'serve' = 'build',
): Promise<Record<string, unknown>> {
  const hook = plugin.config as unknown as AnyFn | undefined;
  if (typeof hook !== 'function') {
    throw new Error('plugin.config is not a function');
  }
  const result = await hook.call(
    plugin,
    { root },
    {
      command,
      mode: command === 'build' ? 'production' : 'development',
      isPreview: false,
    },
  );
  return (result ?? {}) as Record<string, unknown>;
}

async function invokeHook(plugin: ReturnType<typeof vttforge>, name: 'writeBundle'): Promise<void> {
  const hook = plugin[name] as unknown as AnyFn | undefined;
  if (typeof hook !== 'function') return;
  await hook.call(plugin);
}

function defaultOptions(overrides: Partial<VttforgeOptions> = {}): VttforgeOptions {
  return { id: 'fixture-system', kind: 'system', ...overrides };
}

describe('@vttforge/vite-plugin', () => {
  let workdir: string;

  beforeEach(() => {
    workdir = createFixtureWorkspace();
  });

  afterEach(() => {
    rmSync(workdir, { recursive: true, force: true });
  });

  it('exports a version constant', () => {
    expect(VTTFORGE_VITE_PLUGIN_VERSION).toBeTypeOf('string');
  });

  it('returns a Vite plugin with the right shape', () => {
    const plugin = vttforge(defaultOptions());
    expect(plugin.name).toBe('@vttforge/vite-plugin');
    expect(plugin.enforce).toBe('pre');
    expect(typeof plugin.config).toBe('function');
    expect(typeof plugin.writeBundle).toBe('function');
  });

  describe('option validation', () => {
    it('throws when id is missing', () => {
      expect(() =>
        invokeConfigHook(vttforge({ id: '' } as VttforgeOptions), workdir),
      ).rejects.toThrow(/`id` option is required/);
    });

    it('throws when kind is invalid', () => {
      expect(() =>
        invokeConfigHook(
          vttforge({ id: 'fixture-system', kind: 'plugin' } as unknown as VttforgeOptions),
          workdir,
        ),
      ).rejects.toThrow(/`kind` must be 'system' or 'module'/);
    });

    it('throws when entry file is missing', async () => {
      rmSync(resolve(workdir, 'scripts/main.mjs'));
      const plugin = vttforge(defaultOptions());
      await expect(invokeConfigHook(plugin, workdir)).rejects.toThrow(/Entry file not found/);
    });
  });

  describe('Vite config shape', () => {
    it('sets base to /systems/<id>/ for systems', async () => {
      const plugin = vttforge(defaultOptions({ kind: 'system' }));
      const config = await invokeConfigHook(plugin, workdir);
      expect(config.base).toBe('/systems/fixture-system/');
    });

    it('sets base to /modules/<id>/ for modules', async () => {
      writeFileSync(
        resolve(workdir, 'module.json'),
        readFileSync(resolve(workdir, 'system.json'), 'utf8'),
      );
      const plugin = vttforge(defaultOptions({ kind: 'module' }));
      const config = await invokeConfigHook(plugin, workdir);
      expect(config.base).toBe('/modules/fixture-system/');
    });

    it('disables publicDir and sets browser target', async () => {
      const plugin = vttforge(defaultOptions());
      const config = await invokeConfigHook(plugin, workdir);
      expect(config.publicDir).toBe(false);
      const build = config.build as Record<string, unknown>;
      expect(build.target).toBe('es2022');
    });

    it('emits main.mjs entry with no hashing', async () => {
      const plugin = vttforge(defaultOptions());
      const config = await invokeConfigHook(plugin, workdir);
      const build = config.build as Record<string, unknown>;
      const rollup = build.rollupOptions as Record<string, unknown>;
      const input = rollup.input as Record<string, string>;
      expect(input['main.mjs']).toContain('scripts/main.mjs');
      const output = rollup.output as {
        entryFileNames: (info: { name: string }) => string;
        assetFileNames: (info: { name?: string }) => string;
        chunkFileNames: string;
      };
      expect(output.entryFileNames({ name: 'main.mjs' })).toBe('main.mjs');
      expect(output.entryFileNames({ name: 'styles/main.css' })).toBe('[name]');
      expect(output.chunkFileNames).toBe('chunks/[name].mjs');
      expect(output.assetFileNames({ name: 'whatever.css' })).toBe('styles/[name][extname]');
      expect(output.assetFileNames({ name: 'image.png' })).toBe('assets/[name][extname]');
    });

    it('includes CSS entries from the manifest in rollup input under flat basename keys', async () => {
      const plugin = vttforge(defaultOptions());
      const config = await invokeConfigHook(plugin, workdir);
      const build = config.build as Record<string, unknown>;
      const rollup = build.rollupOptions as Record<string, unknown>;
      const input = rollup.input as Record<string, string>;
      expect(input.main).toContain('styles/main.css');
    });

    it('keeps the external list empty so Foundry gets a fully resolved bundle', async () => {
      const plugin = vttforge(defaultOptions());
      const config = await invokeConfigHook(plugin, workdir);
      const build = config.build as Record<string, unknown>;
      const rollup = build.rollupOptions as Record<string, unknown>;
      expect(rollup.external).toEqual([]);
    });

    it('disables minification when running in watch / serve mode', async () => {
      const plugin = vttforge(defaultOptions());
      const config = await invokeConfigHook(plugin, workdir, 'serve');
      const build = config.build as Record<string, unknown>;
      expect(build.minify).toBe(false);
    });
  });

  describe('static + manifest pipeline', () => {
    it('copies static assets to dist/ on writeBundle', async () => {
      const plugin = vttforge(defaultOptions());
      await invokeConfigHook(plugin, workdir);
      await invokeHook(plugin, 'writeBundle');
      expect(existsSync(resolve(workdir, 'dist/lang/en.json'))).toBe(true);
      expect(existsSync(resolve(workdir, 'dist/templates/sheet.hbs'))).toBe(true);
      expect(existsSync(resolve(workdir, 'dist/template.json'))).toBe(true);
    });

    it('syncs version from package.json and rewrites manifest paths on writeBundle', async () => {
      const plugin = vttforge(defaultOptions());
      await invokeConfigHook(plugin, workdir);
      await invokeHook(plugin, 'writeBundle');
      const manifest = JSON.parse(
        readFileSync(resolve(workdir, 'dist/system.json'), 'utf8'),
      ) as Record<string, unknown>;
      expect(manifest.version).toBe('9.9.9');
      expect(manifest.esmodules).toEqual(['main.mjs']);
      expect(manifest.styles).toEqual(['styles/main.css']);
    });

    it('throws when manifest id does not match plugin option', async () => {
      const plugin = vttforge(defaultOptions({ id: 'wrong-id' }));
      await invokeConfigHook(plugin, workdir);
      await expect(invokeHook(plugin, 'writeBundle')).rejects.toThrow(
        /Manifest id 'fixture-system' does not match plugin option id 'wrong-id'/,
      );
    });

    it('respects a custom staticAssets list', async () => {
      const plugin = vttforge(defaultOptions({ staticAssets: ['lang'] }));
      await invokeConfigHook(plugin, workdir);
      await invokeHook(plugin, 'writeBundle');
      expect(existsSync(resolve(workdir, 'dist/lang/en.json'))).toBe(true);
      expect(existsSync(resolve(workdir, 'dist/templates/sheet.hbs'))).toBe(false);
    });

    it('emits a custom-path manifest at the dist root', async () => {
      // Author lays out their manifest under static/system.json — the plugin
      // must still write the artifact's manifest at dist/system.json so
      // Foundry can discover it. Regression: a previous draft preserved the
      // source path under dist/.
      mkdirSync(resolve(workdir, 'static'));
      writeFileSync(
        resolve(workdir, 'static/system.json'),
        readFileSync(resolve(workdir, 'system.json'), 'utf8'),
      );
      rmSync(resolve(workdir, 'system.json'));
      const plugin = vttforge(defaultOptions({ manifest: 'static/system.json' }));
      await invokeConfigHook(plugin, workdir);
      await invokeHook(plugin, 'writeBundle');
      expect(existsSync(resolve(workdir, 'dist/system.json'))).toBe(true);
      expect(existsSync(resolve(workdir, 'dist/static/system.json'))).toBe(false);
    });

    it('emits the manifest under Foundry canonical filename regardless of source basename', async () => {
      // Even when the source manifest is named `forge.json`, the dist artifact
      // must be `system.json` (or `module.json`) — that's the only path
      // Foundry's package loader looks at.
      writeFileSync(
        resolve(workdir, 'forge.json'),
        readFileSync(resolve(workdir, 'system.json'), 'utf8'),
      );
      rmSync(resolve(workdir, 'system.json'));
      const plugin = vttforge(defaultOptions({ manifest: 'forge.json' }));
      await invokeConfigHook(plugin, workdir);
      await invokeHook(plugin, 'writeBundle');
      expect(existsSync(resolve(workdir, 'dist/system.json'))).toBe(true);
      expect(existsSync(resolve(workdir, 'dist/forge.json'))).toBe(false);
    });

    it('drops stylesheet entries added after Vite started instead of advertising an unbuilt file', async () => {
      const plugin = vttforge(defaultOptions());
      await invokeConfigHook(plugin, workdir);
      // Simulate the consumer editing the manifest mid-watch to declare a
      // brand-new stylesheet that the captured rollup input graph never saw.
      const manifest = JSON.parse(readFileSync(resolve(workdir, 'system.json'), 'utf8')) as Record<
        string,
        unknown
      >;
      manifest.styles = ['styles/main.css', 'styles/theme.css'];
      writeFileSync(resolve(workdir, 'system.json'), JSON.stringify(manifest, null, 2));
      await invokeHook(plugin, 'writeBundle');
      const written = JSON.parse(
        readFileSync(resolve(workdir, 'dist/system.json'), 'utf8'),
      ) as Record<string, unknown>;
      expect(written.styles).toEqual(['styles/main.css']);
    });

    it('drops a stylesheet entry that was repointed mid-watch (same basename, new source)', async () => {
      // Edge case: consumer repoints `styles/main.css` to `themes/main.css`.
      // Same basename, but the new source was never in Rollup's input graph.
      // The manifest must NOT advertise it under the old path with the
      // outdated bundle content.
      const plugin = vttforge(defaultOptions());
      await invokeConfigHook(plugin, workdir);
      mkdirSync(resolve(workdir, 'themes'));
      writeFileSync(resolve(workdir, 'themes/main.css'), '.themed { color: gold; }');
      const manifest = JSON.parse(readFileSync(resolve(workdir, 'system.json'), 'utf8')) as Record<
        string,
        unknown
      >;
      manifest.styles = ['themes/main.css'];
      writeFileSync(resolve(workdir, 'system.json'), JSON.stringify(manifest, null, 2));
      await invokeHook(plugin, 'writeBundle');
      const written = JSON.parse(
        readFileSync(resolve(workdir, 'dist/system.json'), 'utf8'),
      ) as Record<string, unknown>;
      expect(written.styles).toEqual([]);
    });

    it('refuses to silently drop a stylesheet when two CSS basenames collide', async () => {
      // Two stylesheets in different directories sharing the same filename
      // would have collapsed into a single rollup input + manifest entry —
      // erase rather than overwrite.
      mkdirSync(resolve(workdir, 'styles/themes'), { recursive: true });
      writeFileSync(resolve(workdir, 'styles/themes/main.css'), '.theme { color: gold; }');
      const manifest = JSON.parse(readFileSync(resolve(workdir, 'system.json'), 'utf8')) as Record<
        string,
        unknown
      >;
      manifest.styles = ['styles/main.css', 'styles/themes/main.css'];
      writeFileSync(resolve(workdir, 'system.json'), JSON.stringify(manifest, null, 2));
      const plugin = vttforge(defaultOptions());
      await expect(invokeConfigHook(plugin, workdir)).rejects.toThrow(
        /Stylesheet basename collision/,
      );
    });
  });
});
