# TravelApp — Group Travel Aggregator

A full-stack group travel aggregator platform ("Swiggy for group trips") targeting Pune as launch city.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 14, React 18, Tailwind CSS, shadcn/ui, TanStack Query 5 |
| **Backend** | Express 4, TypeScript 5, Prisma 5, PostgreSQL |
| **Payments** | Razorpay SafePay |
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

## Commands Reference

### npm Scripts (Root)

```bash
npm run dev              # Start all dev servers (Turbo)
npm run build            # Build all packages
npm run lint             # Lint all packages
npm run type-check       # TypeScript check (no emit)
npm run test             # Run all tests
npm run format           # Prettier format all files
npm run format:check     # Check formatting without writing
```

### Docker — Development

```bash
npm run docker:up        # Build + start all containers (Postgres, Redis, API, Web)
npm run docker:down      # Stop all containers
npm run docker:logs      # Tail logs from all containers
npm run docker:clean     # Stop + remove volumes + orphans (full reset)
npm run docker:seed      # Run dev seed data
npm run docker:seed:prod # Run production seed data
```

### Docker — Production

```bash
./scripts/deploy-prod.sh                   # Full deploy (build, migrate, seed, Nginx, HTTPS)

# Manual compose commands (use DC shorthand from deploy script)
DC="docker compose --env-file .env.prod -f docker-compose.prod.yml"
$DC up -d                                  # Start all services
$DC down                                   # Stop all services
$DC down -v                                # Stop + delete volumes (data loss!)
$DC logs -f                                # Tail all logs
$DC logs -f api                            # Tail API logs only
$DC restart api web nginx                  # Restart specific services
$DC --profile migrate run --rm migrate     # Run Prisma migrations
$DC --profile seed run --rm seed           # Run production seed
```

### Database (inside apps/api)

```bash
npx prisma migrate dev       # Create + apply migration
npx prisma db push           # Push schema without migration
npx prisma studio            # Open DB browser (port 5555)
npx prisma generate          # Regenerate Prisma client
npm run db:seed              # Seed dev data
npm run db:seed:prod         # Seed production data
```

### Testing

```bash
npm run test                             # All tests (root)
npm run test --workspace=apps/api        # Backend tests only
npm run test --workspace=apps/web        # Frontend tests only

# Inside apps/api or apps/web:
npm run test:watch                       # Watch mode
npm run test:coverage                    # Coverage report (web only)
```

### Docker — Debugging

```bash
docker compose ps                              # List running containers + status
docker compose exec api sh                     # Shell into API container
docker compose exec postgres psql -U travel_user -d travel_dev  # Postgres CLI
docker compose exec redis redis-cli -a dev-redis-pass           # Redis CLI
docker logs travel-api --tail 50               # Last 50 API log lines
docker compose exec api npx prisma studio      # DB Studio inside container
```

For the Cashfree sandbox, use these test values:

┌────────────────────────┬─────────────────┐
│         Field          │      Value      │
├────────────────────────┼─────────────────┤
│ Account Type           │ Individual      │
├────────────────────────┼─────────────────┤
│ Account Holder Name    │ JOHN DOE        │
├────────────────────────┼─────────────────┤
│ PAN Number             │ ABCDE1234F      │
├────────────────────────┼─────────────────┤
│ Beneficiary Name       │ JOHN DOE        │
├────────────────────────┼─────────────────┤
│ IFSC Code              │ YESB0000262     │
├────────────────────────┼─────────────────┤
│ Account Number         │ 026291800001191 │
├────────────────────────┼─────────────────┤
│ Confirm Account Number │ 026291800001191 │

## License

Private — All rights reserved.
