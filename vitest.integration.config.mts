import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/integration/**/*.integration.spec.ts'],
    exclude: [...configDefaults.exclude],
    testTimeout: 15_000,
    hookTimeout: 15_000,
  },
});
