#!/usr/bin/env bash
# PostToolUse hook (Write|Edit) — tracks which workspace package was touched
# and runs a debounced typecheck as an early warning. The Stop hook re-checks
# on session end and blocks with a followup if anything is still broken.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

input=$(cat)
set_hook_context "$input"

file_path=$(extract_file_path "$input")
pkg=$(package_for_path "$file_path")

if [[ -z "$pkg" ]]; then
  exit 0
fi

track_package "$pkg"

if ! debounce_allows_run "$pkg"; then
  exit 0
fi

output=""
if ! output=$(run_package_check "$pkg" typecheck); then
  echo "[travel-hooks] type-check failed in ${pkg} after edit (will retry on session stop):" >&2
  echo "$output" >&2
fi

exit 0
