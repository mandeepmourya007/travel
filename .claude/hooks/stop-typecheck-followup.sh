#!/usr/bin/env bash
# Stop hook — re-runs type-check (+ lint for web) for every workspace package
# touched this session. On failure, blocks the stop and feeds the errors back
# so the agent fixes them before finishing. `stop_hook_active` prevents an
# infinite loop if the fix attempt fails again.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

input=$(cat)
set_hook_context "$input"

stop_hook_active=$(jq -r '.stop_hook_active // false' <<< "$input")

if [[ "$stop_hook_active" == "true" ]]; then
  clear_tracked_packages
  exit 0
fi

packages=$(read_tracked_packages || true)
if [[ -z "$packages" ]]; then
  exit 0
fi

failures=""
while IFS= read -r pkg; do
  [[ -z "$pkg" ]] && continue
  output=""
  if ! output=$(run_package_check "$pkg" full); then
    failures="${failures}

=== ${pkg} ===
${output}"
  fi
done <<< "$packages"

clear_tracked_packages

if [[ -n "$failures" ]]; then
  jq -n --arg reason "Type-check/lint failed in one or more packages touched this session. Fix these errors before stopping:${failures}" \
    '{decision: "block", reason: $reason}'
fi

exit 0
