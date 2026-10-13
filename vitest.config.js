import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Browser tests use jsdom storage, not Node 26's server-side WebStorage.
    execArgv: ['--no-experimental-webstorage'],
  },
});
