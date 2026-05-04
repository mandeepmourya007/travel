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

# ── Detect host IP (prompt if on a remote server) ──
if [[ -z "${HOST_IP:-}" ]]; then
  # Auto-detect: if running as root or no display, likely a remote server
  if [[ "$(whoami)" == "root" ]] || [[ -z "${DISPLAY:-}" && -z "${TERM_PROGRAM:-}" ]]; then
    SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo '')
    echo "🌐 Remote server detected."
    read -rp "   Enter server IP/domain [${SERVER_IP:-localhost}]: " INPUT_IP
    HOST_IP="${INPUT_IP:-${SERVER_IP:-localhost}}"
  else
    HOST_IP="localhost"
  fi
fi

# Read WEB_PORT (from .env file or environment, default 3000)
if [[ -z "${WEB_PORT:-}" && -f "$ROOT_DIR/.env" ]]; then
  WEB_PORT=$(grep -E '^WEB_PORT=' "$ROOT_DIR/.env" 2>/dev/null | cut -d= -f2 | tr -d '[:space:]' || true)
fi
WEB_PORT="${WEB_PORT:-3000}"

# Set URLs based on HOST_IP
if [[ "$HOST_IP" != "localhost" && "$HOST_IP" != "127.0.0.1" ]]; then
  export CLIENT_URL="http://${HOST_IP}:${WEB_PORT}"
  export NEXT_PUBLIC_API_URL="http://${HOST_IP}:4001/api/v1"
  API_PORT=4001
else
  export CLIENT_URL="${CLIENT_URL:-http://localhost:${WEB_PORT}}"
  export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-http://localhost:4001/api/v1}"
  API_PORT=4001
fi

echo "🚀 Starting TravelApp (Docker)..."
echo "   HOST: $HOST_IP"
echo ""

# ── Stop any existing containers ─────────────────────
docker compose down --remove-orphans 2>/dev/null || true

# ── Kill local processes on ports 3000/4000 ──────────
lsof -ti:4000 | xargs kill -9 2>/dev/null || true
lsof -ti:${WEB_PORT} | xargs kill -9 2>/dev/null || true

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
echo "  Frontend:   http://${HOST_IP}:${WEB_PORT}"
echo "  API:        http://${HOST_IP}:${API_PORT}"
echo "  Health:     http://${HOST_IP}:${API_PORT}/health"
echo "  Postgres:   ${HOST_IP}:5432  (travel_user / travel_pass)"
echo "  Redis:      ${HOST_IP}:6379"
echo ""
echo "  Logs:       docker compose logs -f"
echo "  Stop:       ./scripts/docker-down.sh"
echo "  Seed:       docker compose exec api npx tsx prisma/seed.ts"
echo "  DB Studio:  docker compose exec api npx prisma studio"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
