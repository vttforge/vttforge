/**
 * The guards in front of the container.
 *
 * Booting Foundry needs Docker, a licence and a few minutes, so none of that
 * runs here. What runs is every refusal that happens before the first `docker`
 * call: they are the whole reason a consumer gets a readable message instead of
 * a stack trace out of `execFileSync`.
 */
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { startFoundryContainer } from '../container/index.js';

const CREDENTIALS = ['FOUNDRY_LICENSE_KEY', 'FOUNDRY_USERNAME', 'FOUNDRY_PASSWORD'] as const;
const TOUCHED = [...CREDENTIALS, 'FOUNDRY_ACCEPT_LICENSE'] as const;

const saved = new Map<string, string | undefined>();

beforeEach(() => {
  for (const name of TOUCHED) {
    saved.set(name, process.env[name]);
    delete process.env[name];
  }
});

afterEach(() => {
  for (const name of TOUCHED) {
    const value = saved.get(name);
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

function withCredentials(): void {
  for (const name of CREDENTIALS) process.env[name] = 'not-a-real-value';
}

/** A directory holding a manifest, which is what `from` has to point at. */
function builtSystem(id = 'fixture-system'): string {
  const dir = mkdtempSync(join(tmpdir(), 'vttforge-container-test-'));
  writeFileSync(join(dir, 'system.json'), JSON.stringify({ id, version: '1.0.0' }));
  return dir;
}

describe('the licence', () => {
  it('refuses to answer the agreement on the caller behalf', async () => {
    withCredentials();
    await expect(startFoundryContainer()).rejects.toThrow(/will not answer it for you/);
  });

  it('takes acceptLicense as the answer', async () => {
    // Past the licence, the missing credentials are what it complains about.
    await expect(startFoundryContainer({ acceptLicense: true })).rejects.toThrow(
      /Cannot fetch a licensed Foundry/,
    );
  });

  it('takes FOUNDRY_ACCEPT_LICENSE as the answer too', async () => {
    process.env.FOUNDRY_ACCEPT_LICENSE = '1';
    await expect(startFoundryContainer()).rejects.toThrow(/Cannot fetch a licensed Foundry/);
  });

  it('does not read 0, false or empty as acceptance', async () => {
    withCredentials();
    for (const value of ['0', 'false', '']) {
      process.env.FOUNDRY_ACCEPT_LICENSE = value;
      await expect(startFoundryContainer()).rejects.toThrow(/will not answer it for you/);
    }
  });
});

describe('the credentials', () => {
  it('names every one that is missing', async () => {
    process.env.FOUNDRY_USERNAME = 'set';
    await expect(startFoundryContainer({ acceptLicense: true })).rejects.toThrow(
      /FOUNDRY_LICENSE_KEY, FOUNDRY_PASSWORD/,
    );
  });

  it('never puts a value in the message', async () => {
    process.env.FOUNDRY_LICENSE_KEY = 'super-secret-key';
    const error = await startFoundryContainer({ acceptLicense: true }).catch((e: Error) => e);
    // Assert it is the credentials error, so the check below cannot pass by
    // rejecting somewhere else for some other reason.
    expect(String(error)).toMatch(/FOUNDRY_USERNAME, FOUNDRY_PASSWORD/);
    expect(String(error)).not.toContain('super-secret-key');
  });
});

describe('the packages', () => {
  it('asks for a system, because a world runs on one', async () => {
    withCredentials();
    await expect(
      startFoundryContainer({
        acceptLicense: true,
        packages: [{ kind: 'module', id: 'only-a-module', from: builtSystem() }],
      }),
    ).rejects.toThrow(/A world needs a system/);
  });

  it('says which directory has no manifest, before starting anything', async () => {
    withCredentials();
    const missing = mkdtempSync(join(tmpdir(), 'vttforge-container-empty-'));
    await expect(
      startFoundryContainer({
        acceptLicense: true,
        packages: [{ kind: 'system', id: 'no-manifest', from: missing }],
      }),
    ).rejects.toThrow(/No system\.json in .*Point `from` at the build output/s);
  });

  it('reads the module manifest for a module', async () => {
    withCredentials();
    const dir = mkdtempSync(join(tmpdir(), 'vttforge-container-mod-'));
    writeFileSync(join(dir, 'system.json'), JSON.stringify({ id: 'wrong', version: '1.0.0' }));
    await expect(
      startFoundryContainer({
        acceptLicense: true,
        packages: [
          { kind: 'system', id: 'a-system', from: builtSystem() },
          { kind: 'module', id: 'a-module', from: dir },
        ],
      }),
    ).rejects.toThrow(/No module\.json in/);
  });
});
