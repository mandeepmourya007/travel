---
title: Monorepo & Tooling
created: 2026-07-10
type: reference
tags:
  - codebase/infra
  - tooling
---

# Monorepo & Tooling

npm workspaces (`apps/*`, `packages/*`) + ==Turborepo 2==. Node ≥ 20, npm@10. Prettier for formatting, ESLint 8 + typescript-eslint 7.

## Turbo Pipeline (`turbo.json`)

| Task | Config |
| :--- | :--- |
| `build` | `dependsOn: ["^build"]`, outputs `.next/**` (minus cache) + `dist/**` |
| `lint` / `type-check` / `test` | `dependsOn: ["^build"]` |
| `dev` | `cache: false`, `persistent: true` |

`globalDependencies`: `**/.env.*local`.

## TypeScript Base (tsconfig.base.json)

ES2022 target/lib, ESNext modules, bundler resolution, ==`strict: true`==, `noUnusedLocals`/`noUnusedParameters`/`noFallthroughCasesInSwitch`, incremental + declaration maps + sourcemaps.

## Root Scripts

```bash
npm run dev / build / lint / type-check / test   # turbo fan-out
npm run format / format:check                     # prettier
npm run docker:up / docker:down / docker:logs / docker:clean
npm run docker:seed / docker:seed:prod
npm run deploy:prod                               # scripts/deploy-prod.sh
npm run shell                                     # API REPL (apps/api src/repl.ts)
```

## Per-App Scripts

### `@travel/api` (`apps/api`)

```bash
npm run dev          # tsx watch --env-file=.env src/index.ts
npm run build        # prisma generate && tsc
npm run start        # node dist/index.js
npm run test         # vitest run   (test:watch = vitest)
npm run db:migrate   # prisma migrate dev
npm run db:push / db:seed / db:seed:prod / db:studio
npm run shell        # tsx REPL
```

### `@travel/web` (`apps/web`)

```bash
npm run dev          # next dev --turbopack
npm run build        # next build (standalone)
npm run test         # vitest run  (test:coverage = --coverage)
```

### `@travel/shared` (`packages/shared`)

No build — consumed as TS source (`main`/`types` → `src/index.ts`). Only `lint` and `type-check`. See [[Shared Package]].

## Getting Started (from README)

```bash
npm install
cp .env.example .env
cd apps/api && npx prisma migrate dev && cd ../..
npm run dev
```

Or fully containerized: `npm run docker:up` → [[Environment & Deployment#Docker — Dev (docker-compose.yml, Compose ≥ 2.24)]].

> [!note] Root Dependency Overrides
> Root `package.json` pins `react`/`react-dom` 19.2.7 and patches transitive deps (ws, engine.io, tar, postcss, uuid, qs, esbuild) via `overrides`. A stray root dependency on `firebase` also exists.

Related: [[Codebase Overview]] · [[Environment & Deployment]] · [[Testing & Quality]]
