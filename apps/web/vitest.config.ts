import path from 'node:path'

import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // The DB-backed suite boots a real embedded Postgres cluster and replays
    // every migration — slower than unit tests, so it gets a generous budget.
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
  resolve: {
    alias: {
      '@gh-hostels/types': path.resolve(__dirname, '../../packages/types/src'),
      '@': path.resolve(__dirname, '.'),
    },
  },
})
