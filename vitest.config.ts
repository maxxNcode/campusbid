import { defineConfig } from 'vitest/config'

// Integration tests talk to the real Supabase project in .env, so they run in
// Node, one file at a time, with generous timeouts for network calls.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
})
