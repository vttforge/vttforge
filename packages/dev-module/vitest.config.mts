import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The reload handlers touch `document` directly — that is the whole job
    // of the CSS path — so they need a DOM to act on.
    environment: 'happy-dom',
  },
});
