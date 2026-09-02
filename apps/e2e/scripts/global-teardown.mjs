/** Take the container down, unless someone is debugging and asked to keep it. */
import { stop } from './foundry.mjs';

export default function globalTeardown() {
  if (process.env.E2E_KEEP_FOUNDRY === '1') {
    console.log('[e2e] E2E_KEEP_FOUNDRY=1, leaving the container running.');
    return;
  }
  stop();
}
