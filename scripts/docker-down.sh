#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "🛑 Stopping TravelApp containers..."
docker compose down --remove-orphans

echo ""
echo "✅ All containers stopped."
echo ""
echo "  To also delete database data:  docker compose down -v"
