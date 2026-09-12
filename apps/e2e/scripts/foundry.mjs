/**
 * The end-to-end run's Foundry, booted through the same API a consumer gets.
 *
 * Everything that boots a container lives in `@vttforge/testing/container`.
 * This file is what an SDK consumer would write: pick the packages, pick the
 * names, hold the handle. It stays here so the published API is exercised by
 * the repo's own run and not only by its tests.
 *
 * Playwright runs `globalSetup` in one process and the specs in others, so the
 * URL crosses that boundary through `E2E_BASE_URL`. The container handle does
 * not; only the process that started it can stop it.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  foundryContainerLogs,
  startFoundryContainer,
  stopFoundryContainer,
} from '@vttforge/testing/container';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/** Fixed, so `e2e:down` can take the container down from its own process. */
const CONTAINER = 'vttforge-e2e';

/** Set by `start`, read by the specs. Absolute, because it is not always localhost. */
export function baseUrl() {
  const url = process.env.E2E_BASE_URL;
  if (!url) throw new Error('Foundry has not been started: E2E_BASE_URL is not set.');
  return url;
}

/** The handle, once this process has started one. */
let running;

export async function start() {
  running = await startFoundryContainer({
    // The owner of this repo accepts Foundry's licence agreement for its own
    // end-to-end run. A consumer answers for themselves.
    acceptLicense: true,
    name: CONTAINER,
    volume: process.env.E2E_VOLUME ?? 'vttforge-e2e-data',
    port: Number(process.env.E2E_PORT ?? 30001),
    worldId: 'e2e',
    worldTitle: 'VTTForge end-to-end',
    image: process.env.E2E_FOUNDRY_IMAGE ?? 'felddy/foundryvtt:14',
    coreVersion: process.env.E2E_CORE_VERSION ?? '14',
    adminKey: 'vttforge-e2e',
    packages: [
      {
        kind: 'system',
        id: 'vttforge-example',
        from: join(repoRoot, 'examples/simple-system/dist'),
      },
      {
        kind: 'module',
        id: 'vttforge-example-module',
        from: join(repoRoot, 'examples/simple-module/dist'),
      },
    ],
  });
  process.env.E2E_BASE_URL = running.baseUrl;
  return { baseUrl: running.baseUrl, system: running.system, network: running.network };
}

export function stop() {
  stopFoundryContainer(CONTAINER);
  running = undefined;
}

/** By name, not through the handle: a boot that failed left no handle behind. */
export function logs(tail = 40) {
  return foundryContainerLogs(CONTAINER, tail);
}
