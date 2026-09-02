/** Boot Foundry once for the whole run. */
import { logs, start } from './foundry.mjs';

export default async function globalSetup() {
  try {
    const { baseUrl, system, network } = await start();
    console.log(
      `[e2e] Foundry is up at ${baseUrl} running ${system.id}@${system.version}` +
        (network ? ` on the ${network} network` : ''),
    );
  } catch (error) {
    console.error('[e2e] Foundry did not come up.');
    console.error(logs());
    throw error;
  }
}
