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

echo "🛑 Stopping TravelApp containers..."
docker compose down --remove-orphans

echo ""
echo "✅ All containers stopped."
echo ""
echo "  To also delete database data:  docker compose down -v"
