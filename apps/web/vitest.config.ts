import { defineConfig } from 'vitest/config'
import path from 'path'

// esbuild.jsx must be set explicitly: @vitejs/plugin-react's babel transform only
// applies to the "client" environment consumer (Vite's Environment API), but Vitest
// runs test files under a server/ssr consumer, so esbuild's own JSX transform is what
// actually processes .tsx files here — without this it defaults to the classic
// runtime, which needs a global `React` and fails with "React is not defined".
export default defineConfig({
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/types/**', 'src/app/layout.tsx', 'src/app/providers.tsx'],
    },
    setupFiles: ['src/test/setup.ts'],
    css: false,
    pool: 'forks',
  },
  resolve: {
    alias: [
      // More-specific aliases must come before the '@' catch-all.
      // Redirect api-client to a test stub that avoids Next.js store dependencies.
      // MSW intercepts at the network layer, so a plain axios instance suffices.
      {
        find: '@/lib/api-client',
        replacement: path.resolve(__dirname, 'src/test/mocks/api-client.ts'),
      },
      { find: '@', replacement: path.resolve(__dirname, 'src') },
      { find: '@shared', replacement: path.resolve(__dirname, '../../packages/shared/src') },
    ],
  },
})
