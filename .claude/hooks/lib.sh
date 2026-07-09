#!/usr/bin/env bash
# Shared helpers for travel Claude Code hooks.

DEBOUNCE_SECS=4

CLAUDE_SESSION_ID=""
PROJECT_ROOT=""
STATE_DIR=""
TOUCHED_FILE=""

set_hook_context() {
  local input="$1"
  CLAUDE_SESSION_ID=$(jq -r '.session_id // "default"' <<< "$input")
  STATE_DIR="${TMPDIR:-/tmp}/travel-claude-hooks/${CLAUDE_SESSION_ID}"
  TOUCHED_FILE="$STATE_DIR/touched-packages"
  mkdir -p "$STATE_DIR"
}

project_root() {
  if [[ -n "$PROJECT_ROOT" && -d "$PROJECT_ROOT" ]]; then
    echo "$PROJECT_ROOT"
    return
  fi
  if root=$(git rev-parse --show-toplevel 2>/dev/null); then
    echo "$root"
    return
  fi
  pwd
}

extract_file_path() {
  local input="$1"
  jq -r '.tool_input.file_path // .tool_input.path // empty' <<< "$input" 2>/dev/null || true
}

package_for_path() {
  local file="$1"
  case "$file" in
    apps/api/*|*/apps/api/*) echo "api" ;;
    apps/web/*|*/apps/web/*) echo "web" ;;
    packages/shared/*|*/packages/shared/*) echo "shared" ;;
    *) echo "" ;;
  esac
}

track_package() {
  local pkg="$1"
  [[ -z "$pkg" ]] && return 0
  touch "$TOUCHED_FILE"
  if grep -qx "$pkg" "$TOUCHED_FILE" 2>/dev/null; then
    return 0
  fi
  echo "$pkg" >> "$TOUCHED_FILE"
}

clear_tracked_packages() {
  rm -f "$TOUCHED_FILE"
}

clear_debounce_stamps() {
  rm -f "$STATE_DIR"/debounce-*
}

read_tracked_packages() {
  if [[ -f "$TOUCHED_FILE" ]]; then
    sort -u "$TOUCHED_FILE"
  fi
}

debounce_allows_run() {
  local pkg="$1"
  local stamp="$STATE_DIR/debounce-$pkg"
  local now last

  now=$(date +%s)
  if [[ -f "$stamp" ]]; then
    last=$(cat "$stamp")
    if (( now - last < DEBOUNCE_SECS )); then
      return 1
    fi
  fi
  echo "$now" > "$stamp"
  return 0
}

run_package_check() {
  local pkg="$1"
  local mode="${2:-typecheck}" # typecheck | full
  local root
  root=$(project_root)

  case "$pkg" in
    api)
      (cd "$root/apps/api" && npm run type-check) 2>&1
      ;;
    web)
      if [[ "$mode" == "full" ]]; then
        (cd "$root/apps/web" && npm run type-check && npm run lint) 2>&1
      else
        (cd "$root/apps/web" && npm run type-check) 2>&1
      fi
      ;;
    shared)
      (cd "$root/packages/shared" && npm run type-check) 2>&1
      ;;
    *)
      return 0
      ;;
  esac
}
