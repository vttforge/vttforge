/**
 * Boot a real Foundry v13 in Docker, with the example system and module
 * installed, and leave it sitting on the join screen.
 *
 * Foundry's setup screens are never driven, because that is the part that
 * would rot. Three plain steps replace them:
 *
 *   1. The end-user licence is a real HTML form. One POST signs it, and the
 *      signature lands in `Config/license.json`.
 *   2. A world is a directory with a manifest. Writing `world.json` is enough
 *      for Foundry to know the world exists.
 *   3. `Config/options.json` carries a `world` field. Setting it makes the
 *      next start launch that world and create its Gamemaster.
 *
 * So the browser only has to join a world that is already running.
 *
 * ## Why nothing here touches the host filesystem
 *
 * CI runs this from inside a container that shares the host's Docker socket.
 * Every path in a `docker` command is then resolved by the host daemon, not by
 * this process, so a bind mount and a `writeFileSync` to the same string are
 * two different directories. Foundry's data lives in a named volume instead,
 * and everything seeded into it goes through `docker cp`, which crosses that
 * boundary correctly from either side.
 *
 * The same split applies to the network: a published port lands on the host,
 * which is not this process's `localhost` when this process is in a container.
 * So when there is a container to join, Foundry joins its network and is
 * reached by name; otherwise the port is published and reached on localhost.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

const CONTAINER = 'vttforge-e2e';
/** Named, so the licensed Foundry download survives between runs. */
const VOLUME = process.env.E2E_VOLUME ?? 'vttforge-e2e-data';
const PORT = Number(process.env.E2E_PORT ?? 30001);
const WORLD_ID = 'e2e';

/** Pinned rather than floating: a build the run does not choose is a build it cannot report. */
const IMAGE = process.env.E2E_FOUNDRY_IMAGE ?? 'felddy/foundryvtt:13';

/** The three the felddy image needs to fetch a licensed Foundry. */
const REQUIRED_ENV = ['FOUNDRY_LICENSE_KEY', 'FOUNDRY_USERNAME', 'FOUNDRY_PASSWORD'];

/** Set by `start`, read by the tests. Absolute, because it is not always localhost. */
export function baseUrl() {
  const url = process.env.E2E_BASE_URL;
  if (!url) throw new Error('Foundry has not been started: E2E_BASE_URL is not set.');
  return url;
}

function docker(args, options = {}) {
  return execFileSync('docker', args, { encoding: 'utf8', ...options });
}

/**
 * Run a throwaway shell against the data volume. Works while Foundry is
 * stopped. As root, because the main container runs as root and everything it
 * writes into the volume is owned by root.
 */
function inVolume(script) {
  return docker([
    'run',
    '--rm',
    '-u',
    '0:0',
    '-v',
    `${VOLUME}:/data`,
    '--entrypoint',
    'sh',
    IMAGE,
    '-c',
    script,
  ]);
}

/**
 * How this process can reach a container it starts.
 *
 * When this process is itself a container the daemon knows about, the two
 * share a network and Foundry answers to its name. Otherwise the port is
 * published and answers on localhost.
 */
function reachability() {
  const self = process.env.HOSTNAME;
  if (self) {
    try {
      const networks = docker([
        'inspect',
        self,
        '--format',
        '{{range $name, $_ := .NetworkSettings.Networks}}{{$name}} {{end}}',
      ]).trim();
      const network = networks.split(/\s+/).filter(Boolean)[0];
      if (network) {
        return { args: ['--network', network], url: `http://${CONTAINER}:30000`, network };
      }
    } catch {
      // Not a container this daemon knows. Publishing a port is right after all.
    }
  }
  return { args: ['-p', `${PORT}:30000`], url: `http://localhost:${PORT}`, network: null };
}

async function waitFor(label, check, { attempts = 150, everyMs = 2000 } = {}) {
  for (let i = 0; i < attempts; i += 1) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, everyMs));
  }
  throw new Error(`Timed out waiting for ${label} after ${(attempts * everyMs) / 1000}s`);
}

async function answers() {
  try {
    // Every Foundry route redirects somewhere, so any answer means it is up.
    await fetch(baseUrl(), { redirect: 'manual' });
    return true;
  } catch {
    return false;
  }
}

/** Where Foundry is redirecting to, which is how it reports the stage it is at. */
async function stage() {
  const response = await fetch(baseUrl(), { redirect: 'manual' });
  return response.headers.get('location') ?? response.url;
}

/** Copy a built package into the volume, and hand back its manifest. */
function installPackage(kind, id, from) {
  const manifestName = kind === 'systems' ? 'system.json' : 'module.json';
  inVolume(`rm -rf /data/Data/${kind}/${id} && mkdir -p /data/Data/${kind}/${id}`);
  // The trailing `/.` copies the contents rather than the directory itself.
  docker(['cp', `${from}/.`, `${CONTAINER}:/data/Data/${kind}/${id}`]);
  return JSON.parse(readFileSync(join(from, manifestName), 'utf8'));
}

/** Read a config file out of the volume, hand it to `edit`, and put it back. */
function editJson(pathInVolume, edit) {
  const scratch = mkdtempSync(join(tmpdir(), 'vttforge-e2e-'));
  const local = join(scratch, 'file.json');
  docker(['cp', `${CONTAINER}:${pathInVolume}`, local]);
  const value = edit(JSON.parse(readFileSync(local, 'utf8')));
  writeFileSync(local, `${JSON.stringify(value, null, 2)}\n`);
  docker(['cp', local, `${CONTAINER}:${pathInVolume}`]);
}

function writeWorld(system) {
  const scratch = mkdtempSync(join(tmpdir(), 'vttforge-e2e-'));
  const local = join(scratch, 'world.json');
  writeFileSync(
    local,
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
  inVolume(`mkdir -p /data/Data/worlds/${WORLD_ID}`);
  docker(['cp', local, `${CONTAINER}:/data/Data/worlds/${WORLD_ID}/world.json`]);
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
  // The worlds and the config are per-run; the downloaded Foundry beside them
  // is not, and re-downloading it every run would cost two minutes each time.
  try {
    inVolume('rm -rf /data/Data /data/Config');
  } catch {
    // First run: the volume does not exist yet, and `docker run` will make it.
  }

  const reach = reachability();
  process.env.E2E_BASE_URL = reach.url;

  docker([
    'run',
    '-d',
    '--name',
    CONTAINER,
    // felddy's entrypoint chowns the volume on first boot, then drops privileges.
    '-u',
    '0:0',
    ...reach.args,
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
    `${VOLUME}:/data`,
    IMAGE,
  ]);

  await waitFor(`Foundry to answer at ${reach.url}`, answers);

  // 1. Sign the licence. Until this is done every route redirects to /license.
  await fetch(`${baseUrl()}/license`, {
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
  editJson('/data/Config/options.json', (options) => ({ ...options, world: WORLD_ID }));

  // 3. Restart into it. Foundry refuses to start over its own lock, and
  // stopping the container does not always clear it. The lock is a directory.
  docker(['stop', CONTAINER]);
  inVolume('rm -rf /data/Config/options.json.lock');
  docker(['start', CONTAINER]);

  await waitFor('Foundry to answer again', answers);
  await waitFor('the world to launch', async () => (await stage()).endsWith('/join'));

  return { baseUrl: baseUrl(), system, network: reach.network };
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
