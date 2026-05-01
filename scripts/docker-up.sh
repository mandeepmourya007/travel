#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "🚀 Starting TravelApp (Docker)..."
echo ""

# ── Stop any existing containers ─────────────────────
docker compose down --remove-orphans 2>/dev/null || true

# ── Kill local processes on ports 3000/4000 ──────────
lsof -ti:4000 | xargs kill -9 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

# ── Build and start ──────────────────────────────────
echo "📦 Building images..."
docker compose build api web

echo ""
echo "🗄️  Starting Postgres + Redis..."
docker compose up -d postgres redis
echo "⏳ Waiting for healthy databases..."
docker compose --profile migrate run --rm migrate

echo ""
echo "🔧 Starting API + Web..."
docker compose up -d api web

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ TravelApp is running!"
echo ""
echo "  Frontend:   http://localhost:3000"
echo "  API:        http://localhost:4000"
echo "  Health:     http://localhost:4000/health"
echo "  Postgres:   localhost:5432  (travel_user / travel_pass)"
echo "  Redis:      localhost:6379"
echo ""
echo "  Logs:       docker compose logs -f"
echo "  Stop:       ./scripts/docker-down.sh"
echo "  DB Studio:  docker compose exec api npx prisma studio"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
