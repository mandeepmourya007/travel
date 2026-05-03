#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

# ── Colima socket (macOS-only) ────────────────────────
# When using Colima instead of Docker Desktop on macOS, the Docker socket
# lives in ~/.colima/ instead of /var/run/docker.sock. This auto-detects it.
if [[ -z "${DOCKER_HOST:-}" ]] && [[ -S "$HOME/.colima/default/docker.sock" ]]; then
  export DOCKER_HOST="unix://$HOME/.colima/default/docker.sock"
fi

# ── Ensure Docker daemon is reachable ─────────────────
if ! docker info >/dev/null 2>&1; then
  if command -v colima >/dev/null 2>&1; then
    echo "⏳ Docker daemon not responding — restarting Colima..."
    colima stop 2>/dev/null || true
    colima start
    export DOCKER_HOST="unix://$HOME/.colima/default/docker.sock"
  else
    echo "❌ Docker daemon is not running. Start it with: sudo systemctl start docker"
    exit 1
  fi
fi

# ── Wait for Docker socket to be fully ready ──────────
# Use "docker compose version" as a heavier smoke-test — docker info can pass
# on a half-alive Colima VM while compose/BuildKit connections still fail.
MAX_RETRIES=15
for i in $(seq 1 $MAX_RETRIES); do
  if docker info >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    break
  fi
  if [ "$i" -eq "$MAX_RETRIES" ]; then
    echo "❌ Docker daemon not ready after ${MAX_RETRIES}s. Try: colima restart"
    exit 1
  fi
  echo "⏳ Waiting for Docker socket... (${i}/${MAX_RETRIES})"
  sleep 2
done

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
