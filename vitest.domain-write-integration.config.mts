import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/integration/domain-write-flow.integration.spec.ts'],
    exclude: [...configDefaults.exclude],
    testTimeout: 30_000,
    hookTimeout: 15_000,
  },
});
