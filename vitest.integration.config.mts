import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/integration/**/*.integration.spec.ts'],
    exclude: [...configDefaults.exclude, 'test/integration/domain-write-flow.integration.spec.ts'],
    testTimeout: 15_000,
    hookTimeout: 15_000,
  },
});
