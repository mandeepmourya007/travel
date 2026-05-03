# TravelApp — Group Travel Aggregator

A full-stack group travel aggregator platform ("Swiggy for group trips") targeting Pune as launch city.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 14, React 18, Tailwind CSS, shadcn/ui, TanStack Query 5 |
| **Backend** | Express 4, TypeScript 5, Prisma 5, PostgreSQL |
| **Payments** | Razorpay Escrow |
| **Real-time** | Socket.IO |
| **Cache/Rate Limit** | Redis (ioredis) |
| **File Uploads** | Cloudinary (direct upload with signed URLs) |
| **Monorepo** | Turborepo |

## Project Structure

```
travel-app/
├── apps/
│   ├── web/          # Next.js frontend (port 3000)
│   └── api/          # Express backend (port 4000)
├── packages/
│   └── shared/       # Shared types, constants, validators, theme tokens
├── docs/
│   ├── engineering/  # tech-stack.md, db-design.md, design-system.md
│   ├── mvp/          # mvp-plan.md
│   └── rnd/          # market-research.md
└── .windsurf/
    └── workflows/    # build-backend.md, build-frontend.md, build-feature.md
```

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Copy environment variables
cp .env.example .env

# 3. Set up database
cd apps/api && npx prisma migrate dev && cd ../..

# 4. Run development servers
npm run dev
```

## Key Documentation

- **[Tech Stack](docs/engineering/tech-stack.md)** — Architecture, design patterns (30+ GoF), folder structure, API design
- **[DB Design](docs/engineering/db-design.md)** — 15 MVP tables, indexes, soft-delete, race condition handling
- **[MVP Plan](docs/mvp/mvp-plan.md)** — Features, wireframes, user flows, timeline
- **[Design System](docs/engineering/fe/design-system.md)** — Colors, typography, component patterns

## Architecture Patterns

This codebase uses **30+ GoF design patterns** documented in `tech-stack.md` Section 1:

- **Creational** — Singleton (Prisma, Redis), Factory Method (query keys, errors), Builder (query filters)
- **Structural** — Facade (BookingService), Adapter (apiClient), Decorator (asyncHandler), Repository
- **Behavioral** — Chain of Responsibility (middleware), Strategy (sort/booking mode), Observer (Socket.IO)

## Development Workflows

Use these Windsurf workflows for feature development:

```
/build-feature   # Full-stack: DB → BE (TDD) → FE → Integration
/build-backend   # Backend only: TDD, clean architecture
/build-frontend  # Frontend only: hooks, components, 4-state rendering
```

## License

Private — All rights reserved.
