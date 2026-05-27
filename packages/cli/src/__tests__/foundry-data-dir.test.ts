import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  autoDetectFoundryDataDir,
  configPath,
  foundryPackagesDir,
  loadConfig,
  looksLikeFoundryDataDir,
  resolveFoundryDataDir,
  saveConfig,
} from '../foundry-data-dir.js';

describe('autoDetectFoundryDataDir', () => {
  it('returns ~/Library/Application Support/FoundryVTT on darwin', () => {
    expect(autoDetectFoundryDataDir('darwin', {}, '/Users/dev')).toBe(
      '/Users/dev/Library/Application Support/FoundryVTT',
    );
  });

  it('returns ~/.local/share/FoundryVTT on linux without XDG_DATA_HOME', () => {
    expect(autoDetectFoundryDataDir('linux', {}, '/home/dev')).toBe(
      '/home/dev/.local/share/FoundryVTT',
    );
  });

  it('honors XDG_DATA_HOME on linux', () => {
    expect(autoDetectFoundryDataDir('linux', { XDG_DATA_HOME: '/custom/xdg' }, '/home/dev')).toBe(
      '/custom/xdg/FoundryVTT',
    );
  });

  it('returns %LOCALAPPDATA%/FoundryVTT on win32', () => {
    expect(
      autoDetectFoundryDataDir('win32', { LOCALAPPDATA: 'C:\\Users\\dev\\AppData\\Local' }, ''),
    ).toBe('C:\\Users\\dev\\AppData\\Local/FoundryVTT');
  });

  it('returns null on win32 without LOCALAPPDATA', () => {
    expect(autoDetectFoundryDataDir('win32', {}, '')).toBeNull();
  });

  it('returns null for unknown platforms', () => {
    expect(autoDetectFoundryDataDir('freebsd' as NodeJS.Platform, {}, '/home/dev')).toBeNull();
  });
});

describe('looksLikeFoundryDataDir', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'vttforge-data-'));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it('returns true when Data/ is present (canonical user-data root)', async () => {
    await mkdir(join(tmp, 'Data'));
    expect(looksLikeFoundryDataDir(tmp)).toBe(true);
  });

  it('returns true when systems/ is present (path is Data/ itself)', async () => {
    await mkdir(join(tmp, 'systems'));
    expect(looksLikeFoundryDataDir(tmp)).toBe(true);
  });

  it('returns true when modules/ is present', async () => {
    await mkdir(join(tmp, 'modules'));
    expect(looksLikeFoundryDataDir(tmp)).toBe(true);
  });

  it('returns false for an empty directory', () => {
    expect(looksLikeFoundryDataDir(tmp)).toBe(false);
  });

  it('returns false for a non-existent path', () => {
    expect(looksLikeFoundryDataDir(join(tmp, 'does-not-exist'))).toBe(false);
  });
});

describe('loadConfig / saveConfig', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'vttforge-cfg-'));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it('returns null when the config file does not exist', async () => {
    expect(await loadConfig(tmp)).toBeNull();
  });

  it('saves and reads back the foundryDataDir field', async () => {
    await saveConfig(tmp, { foundryDataDir: '/foundry/data' });
    expect(await loadConfig(tmp)).toEqual({ foundryDataDir: '/foundry/data' });
    expect(existsSync(configPath(tmp))).toBe(true);
  });

  it('creates the .vttforge directory when saving', async () => {
    await saveConfig(tmp, { foundryDataDir: '/foundry/data' });
    expect(existsSync(join(tmp, '.vttforge'))).toBe(true);
  });

  it('writes JSON with a trailing newline (Unix convention)', async () => {
    await saveConfig(tmp, { foundryDataDir: '/foundry/data' });
    const raw = readFileSync(configPath(tmp), 'utf8');
    expect(raw.endsWith('\n')).toBe(true);
  });

  it('returns null when the config file contains invalid JSON', async () => {
    await mkdir(join(tmp, '.vttforge'), { recursive: true });
    await writeFile(configPath(tmp), 'not-json', 'utf8');
    expect(await loadConfig(tmp)).toBeNull();
  });

  it('returns null when the config file is a JSON array', async () => {
    await mkdir(join(tmp, '.vttforge'), { recursive: true });
    await writeFile(configPath(tmp), '[]', 'utf8');
    expect(await loadConfig(tmp)).toBeNull();
  });
});

describe('foundryPackagesDir', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'vttforge-pkgs-'));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it('returns Data/<type>s under a user-data root with sibling Data folder', async () => {
    await mkdir(join(tmp, 'Data', 'systems'), { recursive: true });
    expect(foundryPackagesDir(tmp, 'system')).toBe(join(tmp, 'Data', 'systems'));
  });

  it('treats a path whose basename is "Data" as the Data folder itself', async () => {
    const dataPath = mkdtempSync(join(tmpdir(), 'vttforge-Data-'));
    // Rename so the basename is literally "Data".
    const renamed = join(dirname(dataPath), 'Data');
    try {
      rmSync(dataPath, { recursive: true, force: true });
      await mkdir(renamed, { recursive: true });
      // Crucially: NO systems/modules/worlds yet — pure fresh data folder.
      expect(foundryPackagesDir(renamed, 'system')).toBe(join(renamed, 'systems'));
      expect(foundryPackagesDir(renamed, 'module')).toBe(join(renamed, 'modules'));
    } finally {
      rmSync(renamed, { recursive: true, force: true });
    }
  });

  it('treats a path containing systems/modules/worlds as the Data folder', async () => {
    // Path basename is not "Data" but it has a worlds/ subfolder, so it is
    // unambiguously the Data folder. Avoid double-nesting Data/Data/.
    await mkdir(join(tmp, 'worlds'));
    expect(foundryPackagesDir(tmp, 'system')).toBe(join(tmp, 'systems'));
  });

  it('detects "Data" folder names case-insensitively', async () => {
    // macOS HFS+/APFS and Windows NTFS volumes are typically case-insensitive,
    // so a user might type DATA or dAtA. We honor that.
    for (const variant of ['DATA', 'dAtA', 'data']) {
      const parent = mkdtempSync(join(tmpdir(), 'vttforge-data-case-'));
      const dataPath = join(parent, variant);
      try {
        await mkdir(dataPath);
        expect(foundryPackagesDir(dataPath, 'system')).toBe(join(dataPath, 'systems'));
      } finally {
        rmSync(parent, { recursive: true, force: true });
      }
    }
  });

  it('returns canonical Data/<type>s/ when path has no Data hints (assumed user-data root)', () => {
    expect(foundryPackagesDir(tmp, 'system')).toBe(join(tmp, 'Data', 'systems'));
  });
});

describe('resolveFoundryDataDir — tilde expansion', () => {
  let tmp: string;
  let fakeHome: string;

  beforeEach(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'vttforge-tilde-'));
    fakeHome = mkdtempSync(join(tmpdir(), 'vttforge-home-'));
    await mkdir(join(fakeHome, 'foundry-data'), { recursive: true });
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
    rmSync(fakeHome, { recursive: true, force: true });
  });

  it('expands `~/x` in the override flag', async () => {
    const result = await resolveFoundryDataDir({
      cwd: tmp,
      override: '~/foundry-data',
      home: fakeHome,
    });
    expect(result).toBe(join(fakeHome, 'foundry-data'));
  });

  it('expands `~/x` in FOUNDRY_DATA_DIR env', async () => {
    const result = await resolveFoundryDataDir({
      cwd: tmp,
      env: { FOUNDRY_DATA_DIR: '~/foundry-data' },
      home: fakeHome,
    });
    expect(result).toBe(join(fakeHome, 'foundry-data'));
  });

  it('expands `~/x` from the prompt', async () => {
    const result = await resolveFoundryDataDir({
      cwd: tmp,
      env: {},
      platform: 'darwin',
      home: fakeHome,
      prompt: async () => '~/foundry-data',
    });
    expect(result).toBe(join(fakeHome, 'foundry-data'));
  });

  it('treats bare `~` as the home directory itself', async () => {
    const result = await resolveFoundryDataDir({
      cwd: tmp,
      override: '~',
      home: fakeHome,
    });
    expect(result).toBe(fakeHome);
  });

  it('leaves paths without a leading tilde alone', async () => {
    const result = await resolveFoundryDataDir({
      cwd: tmp,
      override: '/absolute/path',
      home: fakeHome,
    });
    expect(result).toBe('/absolute/path');
  });
});

describe('resolveFoundryDataDir', () => {
  let tmp: string;
  let dataRoot: string;

  beforeEach(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'vttforge-resolve-'));
    dataRoot = mkdtempSync(join(tmpdir(), 'vttforge-foundry-'));
    await mkdir(join(dataRoot, 'Data'), { recursive: true });
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
    rmSync(dataRoot, { recursive: true, force: true });
  });

  it('returns the override when provided, regardless of env or config', async () => {
    const result = await resolveFoundryDataDir({
      cwd: tmp,
      override: dataRoot,
      env: { FOUNDRY_DATA_DIR: '/ignored' },
    });
    expect(result).toBe(dataRoot);
  });

  it('reads FOUNDRY_DATA_DIR from env when no override', async () => {
    const result = await resolveFoundryDataDir({
      cwd: tmp,
      env: { FOUNDRY_DATA_DIR: dataRoot },
    });
    expect(result).toBe(dataRoot);
  });

  it('reads from .vttforge/config.json when env/override absent', async () => {
    await saveConfig(tmp, { foundryDataDir: dataRoot });
    const result = await resolveFoundryDataDir({ cwd: tmp, env: {} });
    expect(result).toBe(dataRoot);
  });

  it('skips a stale config path that no longer exists', async () => {
    await saveConfig(tmp, { foundryDataDir: '/path/that/no/longer/exists' });
    // No prompt → must fall back to auto-detect or throw.
    await expect(
      resolveFoundryDataDir({
        cwd: tmp,
        env: {},
        platform: 'freebsd' as NodeJS.Platform,
        home: '/home/dev',
      }),
    ).rejects.toThrow(/not configured/);
  });

  it('falls back to auto-detected path when it exists and no prompt is provided', async () => {
    // Create a fake home with the canonical darwin layout.
    const fakeHome = mkdtempSync(join(tmpdir(), 'vttforge-home-'));
    const detected = join(fakeHome, 'Library', 'Application Support', 'FoundryVTT', 'Data');
    await mkdir(detected, { recursive: true });
    try {
      const result = await resolveFoundryDataDir({
        cwd: tmp,
        env: {},
        platform: 'darwin',
        home: fakeHome,
      });
      expect(result).toBe(join(fakeHome, 'Library', 'Application Support', 'FoundryVTT'));
    } finally {
      rmSync(fakeHome, { recursive: true, force: true });
    }
  });

  it('throws when nothing resolves and no prompt is provided', async () => {
    await expect(
      resolveFoundryDataDir({
        cwd: tmp,
        env: {},
        platform: 'win32',
        home: '/home/dev',
      }),
    ).rejects.toThrow(/not configured/);
  });

  it('uses the prompt to ask the user and persists the choice', async () => {
    const result = await resolveFoundryDataDir({
      cwd: tmp,
      env: {},
      platform: 'darwin',
      home: '/home/dev',
      prompt: async () => dataRoot,
    });
    expect(result).toBe(dataRoot);
    // Subsequent run should hit the saved config and skip the prompt.
    const second = await resolveFoundryDataDir({
      cwd: tmp,
      env: {},
      platform: 'darwin',
      home: '/home/dev',
      prompt: async () => {
        throw new Error('prompt should not be called on second run');
      },
    });
    expect(second).toBe(dataRoot);
  });

  it('throws when the prompt resolves to null (user cancelled)', async () => {
    await expect(
      resolveFoundryDataDir({
        cwd: tmp,
        env: {},
        platform: 'darwin',
        home: '/home/dev',
        prompt: async () => null,
      }),
    ).rejects.toThrow(/No Foundry data directory selected/);
  });
});
