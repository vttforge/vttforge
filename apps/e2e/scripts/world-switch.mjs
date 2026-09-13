/**
 * Two worlds in one run.
 *
 * A module that moves data between worlds cannot be tested in one, and the
 * container API has to make the second world reachable without a consumer
 * writing `docker` commands by hand. This drives that: create a world, launch
 * it, read back what Foundry says it is running, and come back.
 *
 * No browser. The assertions are Foundry's own status endpoint, so this runs
 * next to the Playwright suite rather than inside it, and reuses the same
 * container name and volume. Run it after the suite, never beside it: two
 * containers on one volume wipe each other's data.
 */
import { handle, logs, start, stop } from './foundry.mjs';

const SECOND = 'e2e-second';

function check(label, condition) {
  if (!condition) throw new Error(`Failed: ${label}`);
  console.log(`[worlds] ok: ${label}`);
}

/** What Foundry reports it is running. `world` is the id, empty when idle. */
async function status(baseUrl) {
  const response = await fetch(`${baseUrl}/api/status`);
  if (!response.ok) throw new Error(`GET /api/status answered ${response.status}`);
  return await response.json();
}

async function run() {
  const { baseUrl } = await start();
  const foundry = handle();

  check('the run starts on the world it booted', foundry.worldId === 'e2e');
  check('Foundry agrees', (await status(baseUrl)).world === 'e2e');

  foundry.createWorld({ id: SECOND, title: 'VTTForge end-to-end, second world' });
  check(
    'a world stays idle until it is launched',
    foundry.worldId === 'e2e' && (await status(baseUrl)).world === 'e2e',
  );

  await foundry.switchWorld(SECOND);
  check('the handle reports the new world', foundry.worldId === SECOND);
  check('Foundry is running it', (await status(baseUrl)).world === SECOND);
  check('on the same system', foundry.system.id === 'vttforge-example');

  await foundry.switchWorld('e2e');
  check('and back', foundry.worldId === 'e2e' && (await status(baseUrl)).world === 'e2e');

  const refused = await foundry.switchWorld('no-such-world').then(
    () => null,
    (error) => error,
  );
  check('a world that does not exist is refused', /No world `no-such-world`/.test(String(refused)));
  check('and nothing moved', foundry.worldId === 'e2e');
}

try {
  await run();
  console.log('[worlds] two worlds, one run.');
} catch (error) {
  console.error('[worlds] the check failed.');
  console.error(logs());
  throw error;
} finally {
  if (process.env.E2E_KEEP_FOUNDRY === '1') console.log('[worlds] leaving the container running.');
  else stop();
}
