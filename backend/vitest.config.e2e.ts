import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import { registerStreamJsonCaseLoader } from './vitest.node-options.js';

registerStreamJsonCaseLoader(import.meta.dirname);

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    setupFiles: ['./test/setup/test-env.ts'],
    globalSetup: ['./test/setup/global-setup.mjs'],
    // Spec files share one MariaDB test database and truncate it between
    // tests — run them one at a time to avoid cross-file races.
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
