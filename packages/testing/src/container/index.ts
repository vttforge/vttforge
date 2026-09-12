/**
 * Boot a real Foundry in Docker, install built packages into it, and leave it
 * on the join screen.
 *
 * A unit test with mocked globals answers most questions. Some it cannot: what
 * a migration does to stored documents, whether a sheet renders, whether the
 * manifest a package ships is the one Foundry reads. Those need a running
 * Foundry, and this starts one.
 *
 * The setup screens are never driven, because that is the part that would rot.
 * Three plain steps replace them:
 *
 *   1. The licence agreement is an HTML form. One POST records the answer, and
 *      it lands in `Config/license.json`.
 *   2. A world is a directory with a manifest. Writing `world.json` is enough
 *      for Foundry to know the world exists.
 *   3. `Config/options.json` carries a `world` field. Setting it makes the next
 *      start launch that world and create its Gamemaster.
 *
 * So a browser only has to join a world that is already running.
 *
 * ## You accept the licence, not this code
 *
 * Step 1 answers a legal agreement between you and Foundry. This code will not
 * answer it on your behalf: `startFoundryContainer` throws unless you pass
 * `acceptLicense: true` or set `FOUNDRY_ACCEPT_LICENSE=1`. Read the agreement
 * first. The same goes for the credentials the image needs to fetch a licensed
 * build: they are read from the environment and handed to Docker, never stored
 * and never printed.
 *
 * ## Why nothing here touches the host filesystem
 *
 * A run inside a container that shares the host's Docker socket resolves every
 * path in a `docker` command through the host daemon, not through this process.
 * A bind mount and a `writeFileSync` to the same string are then two different
 * directories. Foundry's data lives in a named volume instead, and everything
 * seeded into it goes through `docker cp`, which crosses that boundary
 * correctly from either side.
 *
 * The same split applies to the network. A published port lands on the host,
 * which is not this process's `localhost` when this process is in a container.
 * So when there is a container to join, Foundry joins its network and is
 * reached by name; otherwise the port is published and reached on localhost.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** What kind of package a directory holds, which names its manifest. */
export type FoundryPackageKind = 'system' | 'module';

/** A built package on disk, ready to copy into the container. */
export interface FoundryPackageSource {
  readonly kind: FoundryPackageKind;
  /** The package id. Becomes the directory name Foundry reads. */
  readonly id: string;
  /** Directory holding the build, with its manifest at the root. */
  readonly from: string;
}

/** The fields this harness reads out of a manifest. The rest is passed through. */
export interface FoundryManifest {
  readonly id: string;
  readonly version: string;
  readonly [key: string]: unknown;
}

export interface FoundryContainerOptions {
  /**
   * You have read Foundry's licence agreement and accept it. Required.
   * `FOUNDRY_ACCEPT_LICENSE=1` in the environment does the same.
   */
  readonly acceptLicense?: boolean;
  /** Packages to install before the world launches. One must be a system. */
  readonly packages?: readonly FoundryPackageSource[];
  /** Docker image. Default `felddy/foundryvtt:14`. */
  readonly image?: string;
  /** Container name. Default `vttforge-foundry`. Two runs sharing one collide. */
  readonly name?: string;
  /** Named volume for Foundry's data. Default `<name>-data`. */
  readonly volume?: string;
  /** Host port, used when the port has to be published. Default `30001`. */
  readonly port?: number;
  /** Id of the world the run creates. Default `vttforge-test`. */
  readonly worldId?: string;
  /** Title of that world. Default `VTTForge test world`. */
  readonly worldTitle?: string;
  /** Foundry major version the world declares. Default `14`. */
  readonly coreVersion?: string;
  /** Admin password for the setup screens. Default `vttforge`. */
  readonly adminKey?: string;
  /** How long to wait on each step. Default 150 tries, 2s apart. */
  readonly wait?: { readonly attempts?: number; readonly everyMs?: number };
}

/** A running Foundry. Call `stop()` when the run is over. */
export interface FoundryContainer {
  /** Absolute, because it is not always localhost. */
  readonly baseUrl: string;
  /** The manifest of the system the world runs on. */
  readonly system: FoundryManifest;
  /** Manifests of everything installed, by package id. */
  readonly packages: ReadonlyMap<string, FoundryManifest>;
  /** The Docker network Foundry joined, or `null` when the port is published. */
  readonly network: string | null;
  /**
   * Copy a built package into the container and hand back its manifest.
   *
   * Foundry scans its packages directory once, at startup. A package installed
   * into a running Foundry stays invisible until `restart()`.
   */
  install(source: FoundryPackageSource): FoundryManifest;
  /**
   * Stop and start, clearing the lock that a stop does not always clear.
   *
   * Resolves once the world is joinable, not merely once the server answers.
   * Those are two different moments, and a package installed between them is
   * not loaded yet.
   */
  restart(): Promise<void>;
  /** The container's last log lines. */
  logs(tail?: number): string;
  /** Remove the container. The volume survives, so the next run starts faster. */
  stop(): void;
}

/** The three the image needs to fetch a licensed build. */
const REQUIRED_ENV = ['FOUNDRY_LICENSE_KEY', 'FOUNDRY_USERNAME', 'FOUNDRY_PASSWORD'] as const;

const MANIFEST_NAME: Record<FoundryPackageKind, string> = {
  system: 'system.json',
  module: 'module.json',
};

/** The directory Foundry reads each kind from. */
const PACKAGE_DIR: Record<FoundryPackageKind, string> = {
  system: 'systems',
  module: 'modules',
};

function docker(args: readonly string[], options: { stdio?: 'ignore' } = {}): string {
  return execFileSync('docker', [...args], { encoding: 'utf8', ...options }) ?? '';
}

/**
 * The last log lines from a container, by name.
 *
 * `FoundryContainer#logs` is the same thing with the name filled in. Reach for
 * this one when the boot itself failed, because then there is no handle and the
 * logs are the only account of what went wrong.
 */
export function foundryContainerLogs(name: string, tail = 40): string {
  try {
    return docker(['logs', '--tail', String(tail), name]);
  } catch {
    return '(no container logs)';
  }
}

/**
 * Remove a container by name, whether or not this process started it.
 *
 * `FoundryContainer#stop` is the same thing with the name already filled in.
 * Use this from a teardown script that runs in its own process, which is where
 * the handle is out of reach. Removing a container that is not there is not an
 * error.
 *
 * The data volume survives, so the next run does not download Foundry again.
 */
export function stopFoundryContainer(name: string): void {
  try {
    docker(['rm', '-f', name], { stdio: 'ignore' });
  } catch {
    // Not running. Nothing to remove.
  }
}

function readManifest(source: FoundryPackageSource): FoundryManifest {
  const path = join(source.from, MANIFEST_NAME[source.kind]);
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    throw new Error(
      `No ${MANIFEST_NAME[source.kind]} in ${source.from}. Point \`from\` at the build output, not the source tree.`,
    );
  }
  return JSON.parse(text) as FoundryManifest;
}

function licenseAccepted(options: FoundryContainerOptions): boolean {
  if (options.acceptLicense === true) return true;
  const fromEnv = process.env.FOUNDRY_ACCEPT_LICENSE;
  return fromEnv !== undefined && fromEnv !== '' && fromEnv !== '0' && fromEnv !== 'false';
}

/**
 * Start Foundry, install the packages, launch a world on them, and wait for
 * the join screen.
 *
 * ```ts
 * const foundry = await startFoundryContainer({
 *   acceptLicense: true,
 *   name: 'my-module-e2e',
 *   packages: [
 *     { kind: 'system', id: 'some-system', from: 'test/fixtures/system' },
 *     { kind: 'module', id: 'my-module', from: 'dist' },
 *   ],
 * });
 * try {
 *   // drive foundry.baseUrl with a browser
 * } finally {
 *   foundry.stop();
 * }
 * ```
 *
 * Needs `docker` on the PATH and `FOUNDRY_LICENSE_KEY`, `FOUNDRY_USERNAME` and
 * `FOUNDRY_PASSWORD` in the environment. First run downloads Foundry, which
 * takes a couple of minutes; later runs reuse the volume.
 */
export async function startFoundryContainer(
  options: FoundryContainerOptions = {},
): Promise<FoundryContainer> {
  if (!licenseAccepted(options)) {
    throw new Error(
      'Booting Foundry records an answer to its licence agreement. This harness will not answer it for you. Read the agreement, then pass `acceptLicense: true` or set FOUNDRY_ACCEPT_LICENSE=1.',
    );
  }

  const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(
      `Cannot fetch a licensed Foundry without ${missing.join(', ')}. Set them in the environment.`,
    );
  }

  const image = options.image ?? 'felddy/foundryvtt:14';
  const name = options.name ?? 'vttforge-foundry';
  const volume = options.volume ?? `${name}-data`;
  const port = options.port ?? 30001;
  const worldId = options.worldId ?? 'vttforge-test';
  const coreVersion = options.coreVersion ?? '14';
  const attempts = options.wait?.attempts ?? 150;
  const everyMs = options.wait?.everyMs ?? 2000;
  const sources = options.packages ?? [];

  const manifests = new Map<string, FoundryManifest>();
  const systemSource = sources.find((source) => source.kind === 'system');
  if (!systemSource) {
    throw new Error(
      'A world needs a system. Pass one package with `kind: "system"` in `packages`.',
    );
  }
  // Read every manifest before anything is started, so a bad path fails fast.
  for (const source of sources) manifests.set(source.id, readManifest(source));
  const system = manifests.get(systemSource.id) as FoundryManifest;

  /**
   * Run a throwaway shell against the data volume. Works while Foundry is
   * stopped. As root, because the main container runs as root and everything
   * it writes into the volume is owned by root.
   */
  const inVolume = (script: string): string =>
    docker([
      'run',
      '--rm',
      '-u',
      '0:0',
      '-v',
      `${volume}:/data`,
      '--entrypoint',
      'sh',
      image,
      '-c',
      script,
    ]);

  const remove = (): void => stopFoundryContainer(name);

  remove();
  // The worlds and the config are per-run; the downloaded Foundry beside them
  // is not, and re-downloading it every run would cost minutes each time.
  try {
    inVolume('rm -rf /data/Data /data/Config');
  } catch {
    // First run: the volume does not exist yet, and `docker run` will make it.
  }

  const reach = reachability(name, port);
  const baseUrl = reach.url;

  docker([
    'run',
    '-d',
    '--name',
    name,
    // The image's entrypoint chowns the volume on first boot, then drops privileges.
    '-u',
    '0:0',
    ...reach.args,
    // Named, not valued: Docker reads each from this process's environment, so
    // no credential is written into an argument list.
    '-e',
    'FOUNDRY_LICENSE_KEY',
    '-e',
    'FOUNDRY_USERNAME',
    '-e',
    'FOUNDRY_PASSWORD',
    '-e',
    `FOUNDRY_ADMIN_KEY=${options.adminKey ?? 'vttforge'}`,
    '-e',
    'CONTAINER_PRESERVE_CONFIG=true',
    '-v',
    `${volume}:/data`,
    image,
  ]);

  const answers = async (): Promise<boolean> => {
    try {
      // Every Foundry route redirects somewhere, so any answer means it is up.
      await fetch(baseUrl, { redirect: 'manual' });
      return true;
    } catch {
      return false;
    }
  };

  /** Where Foundry redirects to, which is how it reports the stage it is at. */
  const stage = async (): Promise<string> => {
    const response = await fetch(baseUrl, { redirect: 'manual' });
    return response.headers.get('location') ?? response.url;
  };

  const waitFor = async (label: string, check: () => Promise<boolean>): Promise<void> => {
    for (let i = 0; i < attempts; i += 1) {
      if (await check()) return;
      await new Promise((resolve) => setTimeout(resolve, everyMs));
    }
    throw new Error(`Timed out waiting for ${label} after ${(attempts * everyMs) / 1000}s`);
  };

  const install = (source: FoundryPackageSource): FoundryManifest => {
    const manifest = manifests.get(source.id) ?? readManifest(source);
    const dir = `/data/Data/${PACKAGE_DIR[source.kind]}/${source.id}`;
    inVolume(`rm -rf ${dir} && mkdir -p ${dir}`);
    // The trailing `/.` copies the contents rather than the directory itself.
    docker(['cp', `${source.from}/.`, `${name}:${dir}`]);
    manifests.set(source.id, manifest);
    return manifest;
  };

  /** Read a config file out of the volume, hand it to `edit`, and put it back. */
  const editJson = (
    pathInVolume: string,
    edit: (value: Record<string, unknown>) => Record<string, unknown>,
  ): void => {
    const local = join(mkdtempSync(join(tmpdir(), 'vttforge-foundry-')), 'file.json');
    docker(['cp', `${name}:${pathInVolume}`, local]);
    const value = edit(JSON.parse(readFileSync(local, 'utf8')) as Record<string, unknown>);
    writeFileSync(local, `${JSON.stringify(value, null, 2)}\n`);
    docker(['cp', local, `${name}:${pathInVolume}`]);
  };

  const restart = async (): Promise<void> => {
    // Foundry refuses to start over its own lock, and stopping the container
    // does not always clear it. The lock is a directory, not a file.
    docker(['stop', name]);
    inVolume('rm -rf /data/Config/options.json.lock');
    docker(['start', name]);
    await waitFor('Foundry to answer again', answers);
    // Answering is not the same as being joinable. Foundry answers as soon as
    // the server is up and launches the world after, so a caller that returns
    // here on the first answer can drive a world that is not there yet.
    await waitFor('the world to launch', async () => (await stage()).endsWith('/join'));
  };

  await waitFor(`Foundry to answer at ${baseUrl}`, answers);

  // 1. Answer the licence agreement. Until this is done every route redirects
  //    to /license. The caller accepted it above; this records that answer.
  await fetch(`${baseUrl}/license`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ agree: 'on', accept: '' }),
    redirect: 'manual',
  });
  await waitFor(
    'the licence answer to register',
    async () => !(await stage()).endsWith('/license'),
  );

  // 2. Install what is under test, and declare a world on it.
  for (const source of sources) install(source);
  writeWorld({
    container: name,
    inVolume,
    worldId,
    title: options.worldTitle ?? 'VTTForge test world',
    system,
    coreVersion,
  });
  editJson('/data/Config/options.json', (value) => ({ ...value, world: worldId }));

  // 3. Restart into it. `restart` waits for the world, not just the server.
  await restart();

  return {
    baseUrl,
    system,
    packages: manifests,
    network: reach.network,
    install,
    restart,
    logs: (tail = 40) => foundryContainerLogs(name, tail),
    stop: remove,
  };
}

/**
 * How this process can reach a container it starts.
 *
 * When this process is itself a container the daemon knows about, the two share
 * a network and Foundry answers to its name. Otherwise the port is published
 * and answers on localhost.
 */
function reachability(
  container: string,
  port: number,
): { args: string[]; url: string; network: string | null } {
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
        return { args: ['--network', network], url: `http://${container}:30000`, network };
      }
    } catch {
      // Not a container this daemon knows. Publishing a port is right after all.
    }
  }
  return { args: ['-p', `${port}:30000`], url: `http://localhost:${port}`, network: null };
}

function writeWorld(args: {
  container: string;
  inVolume: (script: string) => string;
  worldId: string;
  title: string;
  system: FoundryManifest;
  coreVersion: string;
}): void {
  const local = join(mkdtempSync(join(tmpdir(), 'vttforge-foundry-')), 'world.json');
  writeFileSync(
    local,
    `${JSON.stringify(
      {
        id: args.worldId,
        title: args.title,
        description: 'Created by a test run. Thrown away with it.',
        system: args.system.id,
        systemVersion: args.system.version,
        coreVersion: args.coreVersion,
        version: '1.0.0',
        compatibility: { minimum: args.coreVersion, verified: args.coreVersion },
        authors: [],
        packs: [],
        relationships: {},
      },
      null,
      2,
    )}\n`,
  );
  args.inVolume(`mkdir -p /data/Data/worlds/${args.worldId}`);
  docker(['cp', local, `${args.container}:/data/Data/worlds/${args.worldId}/world.json`]);
}
