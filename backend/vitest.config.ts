import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
    setupFiles: ['src/test/env.ts', 'src/test/setup.ts'],
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
