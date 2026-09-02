/**
 * The end-to-end run.
 *
 * One worker and no retries on purpose: the tests share a single Foundry
 * world, and a retry against a world another test has already written to
 * proves nothing.
 */
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  globalSetup: './scripts/global-setup.mjs',
  globalTeardown: './scripts/global-teardown.mjs',
  workers: 1,
  fullyParallel: false,
  retries: 0,
  // Booting a world and rendering a sheet is slower than a unit test, and a
  // tight timeout here would only produce flakes.
  timeout: 120_000,
  reporter: process.env.CI ? [['list'], ['github']] : [['list']],
  use: {
    // No baseURL: where Foundry answers is not known until globalSetup has
    // started it, and depends on whether this process is itself a container.
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
});
