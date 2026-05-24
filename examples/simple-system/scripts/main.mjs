/**
 * vttforge-example — entry point.
 *
 * One-call boot via @vttforge/core's registerSystem(). Replaces what would
 * otherwise be a ~40-line Hooks.once("init", ...) block.
 *
 * `@vttforge/core` must be available at the consumer-resolved path — for a
 * shipped Foundry system that means it's pre-bundled by @vttforge/vite-plugin
 * (v0.2). For this example we leave it as a local resolution to keep the file
 * readable.
 */

import { registerSystem, SystemConfig, VttfError } from '@vttforge/core';

const SYSTEM_ID = 'vttforge-example';

const settings = new SystemConfig(SYSTEM_ID);

try {
  registerSystem({
    id: SYSTEM_ID,
    combat: {
      initiative: { formula: '1d20 + @abilities.dex.mod', decimals: 2 },
    },
    onAfterInit: () => {
      settings.register('schemaVersion', {
        scope: 'world',
        config: false,
        type: Number,
        default: 0,
      });
    },
  });
} catch (err) {
  if (err instanceof VttfError) {
    console.error(`[${err.code}] ${err.message} — see ${err.docsUrl}`);
  }
  throw err;
}
