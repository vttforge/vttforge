import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyHotReload, type FoundryEnv, type HotReloadData } from '../reload.js';

const NOW = 1_700_000_000_000;

function makeEnv(overrides: Partial<FoundryEnv> = {}): FoundryEnv {
  const rendered: Array<{ render: () => void }> = [];
  return {
    Handlebars: {
      compile: vi.fn((input: string) => ({ compiled: input })),
      registerPartial: vi.fn(),
    },
    game: {
      i18n: { lang: 'en', translations: {} },
      system: { languages: [{ path: 'systems/my-system/lang/en.json', lang: 'en' }] },
      modules: { get: () => undefined },
    },
    ui: { windows: {} },
    applicationInstances: () => rendered,
    mergeObject: vi.fn((target: object, source: object) => Object.assign(target, source)),
    callHook: vi.fn(() => true),
    document: globalThis.document,
    now: () => NOW,
    ...overrides,
  };
}

function payload(over: Partial<HotReloadData> = {}): HotReloadData {
  return {
    packageType: 'system',
    packageId: 'my-system',
    content: '',
    path: 'systems/my-system/styles/main.css',
    extension: 'css',
    ...over,
  };
}

beforeEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
});

describe('veto hook', () => {
  it('does nothing when a listener returns false', () => {
    const env = makeEnv({ callHook: vi.fn(() => false) });
    expect(applyHotReload(payload(), env)).toEqual({ applied: false, reason: 'vetoed' });
  });

  it('fires the hook before acting, matching core', () => {
    const env = makeEnv();
    applyHotReload(payload({ extension: 'hbs', content: '<p></p>' }), env);
    expect(env.callHook).toHaveBeenCalledWith(
      'hotReload',
      expect.objectContaining({ extension: 'hbs' }),
    );
  });

  it('ignores an extension it cannot apply in place', () => {
    expect(applyHotReload(payload({ extension: 'mjs' }), makeEnv())).toEqual({
      applied: false,
      reason: 'unsupported-extension',
    });
  });
});

describe('css', () => {
  it('cache-busts the matching stylesheet link', () => {
    const link = document.createElement('link');
    link.href = 'systems/my-system/styles/main.css';
    document.head.append(link);

    expect(applyHotReload(payload(), makeEnv())).toEqual({ applied: true, kind: 'css' });
    expect(link.getAttribute('href')).toBe(`systems/my-system/styles/main.css?${NOW}`);
  });

  it('replaces an existing cache-buster rather than stacking one on', () => {
    const link = document.createElement('link');
    link.href = 'systems/my-system/styles/main.css?999';
    document.head.append(link);

    applyHotReload(payload(), makeEnv());
    expect(link.getAttribute('href')).toBe(`systems/my-system/styles/main.css?${NOW}`);
  });

  it('falls back to an @import inside a style block', () => {
    const style = document.createElement('style');
    style.textContent = '@import "systems/my-system/styles/main.css";';
    document.head.append(style);

    expect(applyHotReload(payload(), makeEnv())).toEqual({ applied: true, kind: 'css' });
    expect(style.textContent).toBe(`@import "systems/my-system/styles/main.css?${NOW}";`);
  });

  it('leaves an unrelated stylesheet alone and reports no match', () => {
    const link = document.createElement('link');
    link.href = 'systems/other/styles/other.css';
    document.head.append(link);

    expect(applyHotReload(payload(), makeEnv())).toEqual({ applied: false, reason: 'no-match' });
    expect(link.getAttribute('href')).toBe('systems/other/styles/other.css');
  });

  it('treats a path with regex characters as a path, not a pattern', () => {
    const style = document.createElement('style');
    style.textContent = '@import "systems/my.system/styles/a+b.css";';
    document.head.append(style);

    const result = applyHotReload(payload({ path: 'systems/my.system/styles/a+b.css' }), makeEnv());
    expect(result).toEqual({ applied: true, kind: 'css' });
    expect(style.textContent).toContain(`a+b.css?${NOW}`);
  });
});

describe('templates', () => {
  it('registers the recompiled template under its path', () => {
    const env = makeEnv();
    const data = payload({
      extension: 'hbs',
      content: '<div>{{name}}</div>',
      path: 'systems/my-system/templates/actor.hbs',
    });

    expect(applyHotReload(data, env)).toEqual({ applied: true, kind: 'html' });
    expect(env.Handlebars.registerPartial).toHaveBeenCalledWith(
      'systems/my-system/templates/actor.hbs',
      { compiled: '<div>{{name}}</div>' },
    );
  });

  it('re-renders both application generations', () => {
    const v1 = { render: vi.fn() };
    const v2 = { render: vi.fn() };
    const env = makeEnv({ ui: { windows: { 1: v1 } }, applicationInstances: () => [v2] });

    applyHotReload(payload({ extension: 'hbs', content: '<p></p>' }), env);
    expect(v1.render).toHaveBeenCalledOnce();
    expect(v2.render).toHaveBeenCalledOnce();
  });

  it('reports a broken template instead of throwing', () => {
    const env = makeEnv({
      Handlebars: {
        compile: () => {
          throw new Error('unclosed block');
        },
        registerPartial: vi.fn(),
      },
    });
    expect(applyHotReload(payload({ extension: 'hbs', content: '{{#if' }), env)).toEqual({
      applied: false,
      reason: 'parse-error',
    });
    expect(env.Handlebars.registerPartial).not.toHaveBeenCalled();
  });

  it('accepts html the same way as hbs', () => {
    expect(applyHotReload(payload({ extension: 'html', content: '<p></p>' }), makeEnv())).toEqual({
      applied: true,
      kind: 'html',
    });
  });
});

describe('language files', () => {
  const langPath = 'systems/my-system/lang/en.json';

  it('merges a declared file for the active language', () => {
    const env = makeEnv();
    const data = payload({ extension: 'json', path: langPath, content: '{"KEY":"value"}' });

    expect(applyHotReload(data, env)).toEqual({ applied: true, kind: 'json' });
    expect(env.mergeObject).toHaveBeenCalledWith(env.game.i18n.translations, { KEY: 'value' });
  });

  it('skips a file for a language the user is not viewing', () => {
    const env = makeEnv();
    env.game.i18n.lang = 'pt-BR';
    const data = payload({ extension: 'json', path: langPath, content: '{"KEY":"value"}' });

    expect(applyHotReload(data, env)).toEqual({ applied: false, reason: 'no-match' });
    expect(env.mergeObject).not.toHaveBeenCalled();
  });

  it('skips a json file the manifest never declared as a language', () => {
    const env = makeEnv();
    const data = payload({
      extension: 'json',
      path: 'systems/my-system/template.json',
      content: '{}',
    });

    expect(applyHotReload(data, env)).toEqual({ applied: false, reason: 'no-match' });
  });

  it('reads a module language file off the module, not the system', () => {
    const env = makeEnv({
      game: {
        i18n: { lang: 'en', translations: {} },
        system: { languages: [] },
        modules: {
          get: (id) =>
            id === 'my-module'
              ? { languages: [{ path: 'modules/my-module/lang/en.json', lang: 'en' }] }
              : undefined,
        },
      },
    });
    const data = payload({
      packageType: 'module',
      packageId: 'my-module',
      extension: 'json',
      path: 'modules/my-module/lang/en.json',
      content: '{"A":"b"}',
    });

    expect(applyHotReload(data, env)).toEqual({ applied: true, kind: 'json' });
  });

  it('reports malformed json instead of throwing', () => {
    const env = makeEnv();
    const data = payload({ extension: 'json', path: langPath, content: '{ not json' });

    expect(applyHotReload(data, env)).toEqual({ applied: false, reason: 'parse-error' });
    expect(env.mergeObject).not.toHaveBeenCalled();
  });
});
