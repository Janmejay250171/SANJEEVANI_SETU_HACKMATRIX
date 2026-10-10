import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['server/tests/**/*.test.ts', 'tests/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/P2_Hospital_Cost/**', '**/dist/**'],
    hookTimeout: 60000,
    testTimeout: 60000,
    fileParallelism: false,
  }
});
