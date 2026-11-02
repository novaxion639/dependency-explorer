import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    setupFiles: ['../../test-support/guard.ts'],
    include: ['src/**/*.test.ts', '../../test-support/*.test.ts'],
  },
})
