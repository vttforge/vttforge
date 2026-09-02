/**
 * Boot a real Foundry v13 in Docker, with the example system and module
 * installed, and leave it sitting on the join screen.
 *
 * Everything here happens without touching Foundry's setup UI, which is the
 * part that would rot. Three plain steps do it:
 *
 *   1. The end-user licence is a real HTML form. One POST signs it, and the
 *      signature lands in `Config/license.json`.
 *   2. A world is a directory with a manifest. Writing `world.json` is enough
 *      for Foundry to know the world exists.
 *   3. `Config/options.json` carries a `world` field. Setting it makes the
 *      next start launch that world and create its Gamemaster.
 *
 * So the browser only has to join a world that is already running.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

const CONTAINER = 'vttforge-e2e';
const PORT = Number(process.env.E2E_PORT ?? 30001);
export const BASE_URL = `http://localhost:${PORT}`;
const WORLD_ID = 'e2e';

/** Pinned rather than floating: a build the run does not choose is a build it cannot report. */
const IMAGE = process.env.E2E_FOUNDRY_IMAGE ?? 'felddy/foundryvtt:13';

/**
 * Where Foundry keeps its data.
 *
 * Overridable because CI points it at a path on the runner host, outside the
 * workspace. The licensed Foundry download is cached in here, and a build
 * cache on a public repository is readable from a fork's workflow.
 */
const dataDir = process.env.E2E_DATA_DIR ?? join(repoRoot, 'apps/e2e/.foundry');

/** The three the felddy image needs to fetch a licensed Foundry. */
const REQUIRED_ENV = ['FOUNDRY_LICENSE_KEY', 'FOUNDRY_USERNAME', 'FOUNDRY_PASSWORD'];

function docker(args, options = {}) {
  return execFileSync('docker', args, { encoding: 'utf8', ...options });
}

async function waitFor(label, check, { attempts = 90, everyMs = 2000 } = {}) {
  for (let i = 0; i < attempts; i += 1) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, everyMs));
  }
  throw new Error(`Timed out waiting for ${label} after ${(attempts * everyMs) / 1000}s`);
}

async function answers() {
  try {
    // `redirect: 'manual'` because every Foundry route redirects somewhere;
    // any answer at all means the server is up.
    await fetch(BASE_URL, { redirect: 'manual' });
    return true;
  } catch {
    return false;
  }
}

/** Where Foundry is redirecting to, which is how it reports which stage it is at. */
async function stage() {
  const response = await fetch(BASE_URL, { redirect: 'manual' });
  return response.headers.get('location') ?? response.url;
}

function installPackage(kind, id, from) {
  const to = join(dataDir, 'Data', kind, id);
  rmSync(to, { recursive: true, force: true });
  cpSync(from, to, { recursive: true });
  return JSON.parse(
    readFileSync(join(to, kind === 'systems' ? 'system.json' : 'module.json'), 'utf8'),
  );
}

function writeWorld(system) {
  const worldDir = join(dataDir, 'Data', 'worlds', WORLD_ID);
  mkdirSync(worldDir, { recursive: true });
  writeFileSync(
    join(worldDir, 'world.json'),
    `${JSON.stringify(
      {
        id: WORLD_ID,
        title: 'VTTForge end-to-end',
        description: 'Created by the end-to-end test. Thrown away with the run.',
        system: system.id,
        systemVersion: system.version,
        coreVersion: process.env.E2E_CORE_VERSION ?? '13.351',
        version: '1.0.0',
        compatibility: { minimum: '13', verified: '13' },
        authors: [],
        packs: [],
        relationships: {},
      },
      null,
      2,
    )}\n`,
  );
}

function selectWorld() {
  const file = join(dataDir, 'Config', 'options.json');
  const options = JSON.parse(readFileSync(file, 'utf8'));
  options.world = WORLD_ID;
  writeFileSync(file, `${JSON.stringify(options, null, 2)}\n`);
}

export function stop() {
  try {
    docker(['rm', '-f', CONTAINER], { stdio: 'ignore' });
  } catch {
    // Not running. Nothing to stop.
  }
}

export async function start() {
  const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(
      `Cannot boot Foundry without ${missing.join(', ')}. Copy .env.example to .env, or set them in the environment.`,
    );
  }

  stop();
  // The data directory is disposable, but the downloaded Foundry inside it is
  // not: keeping `container_cache` turns a two-minute download into a restart.
  rmSync(join(dataDir, 'Data'), { recursive: true, force: true });
  rmSync(join(dataDir, 'Config'), { recursive: true, force: true });
  mkdirSync(dataDir, { recursive: true });

  docker([
    'run',
    '-d',
    '--name',
    CONTAINER,
    // felddy's entrypoint chowns the volume on first boot, then drops privileges.
    '-u',
    '0:0',
    '-p',
    `${PORT}:30000`,
    '-e',
    'FOUNDRY_LICENSE_KEY',
    '-e',
    'FOUNDRY_USERNAME',
    '-e',
    'FOUNDRY_PASSWORD',
    '-e',
    'FOUNDRY_ADMIN_KEY=vttforge-e2e',
    '-e',
    'CONTAINER_PRESERVE_CONFIG=true',
    '-v',
    `${dataDir}:/data`,
    IMAGE,
  ]);

  await waitFor('Foundry to answer', answers, { attempts: 150 });

  // 1. Sign the licence. Until this is done every route redirects to /license.
  await fetch(`${BASE_URL}/license`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ agree: 'on', accept: '' }),
    redirect: 'manual',
  });
  await waitFor('the licence to be signed', async () => !(await stage()).endsWith('/license'));

  // 2. Install what is under test, and declare a world on it.
  const system = installPackage(
    'systems',
    'vttforge-example',
    join(repoRoot, 'examples/simple-system/dist'),
  );
  installPackage(
    'modules',
    'vttforge-example-module',
    join(repoRoot, 'examples/simple-module/dist'),
  );
  writeWorld(system);
  selectWorld();

  // 3. Restart into it. Foundry refuses to start over its own lock file, and
  // stopping the container does not always clear it.
  docker(['stop', CONTAINER]);
  // The lock is a directory, not a file.
  rmSync(join(dataDir, 'Config', 'options.json.lock'), { recursive: true, force: true });
  docker(['start', CONTAINER]);

  await waitFor('Foundry to answer again', answers, { attempts: 150 });
  await waitFor('the world to launch', async () => (await stage()).endsWith('/join'));

  return { baseUrl: BASE_URL, system };
}

export function logs(tail = 40) {
  try {
    return docker(['logs', '--tail', String(tail), CONTAINER], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch {
    return '(no container logs)';
  }
}
