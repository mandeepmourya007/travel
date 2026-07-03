import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/types/**', 'src/index.ts'],
    },
    setupFiles: ['tests/setup.ts'],
  },
  resolve: {
    alias: [
      // Exact directory imports — must use regex anchors to prevent prefix-matching
      // @shared/constants/wallet (a file), since string aliases match prefixes.
      { find: /^@shared\/constants$/, replacement: path.resolve(__dirname, '../../packages/shared/src/constants/index.ts') },
      { find: /^@shared\/validators$/, replacement: path.resolve(__dirname, '../../packages/shared/src/validators/index.ts') },
      // All other @shared/* sub-path imports (files like @shared/types/booking.types)
      { find: /^@shared\/(.*)/, replacement: path.resolve(__dirname, '../../packages/shared/src') + '/$1' },
      { find: '@', replacement: path.resolve(__dirname, 'src') },
    ],
  },
})
