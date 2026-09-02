#!/usr/bin/env node
/**
 * vttforge bin: the executable entry.
 *
 * Nothing but the launch. The command tree lives in `cli.ts` so tests can
 * import it without running the CLI.
 */
import { runMain } from 'citty';
import { main } from './cli.js';

runMain(main);
