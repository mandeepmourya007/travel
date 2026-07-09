#!/usr/bin/env bash
# Smoke + integration tests for travel Claude Code hooks.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
HOOKS_DIR="$SCRIPT_DIR"

# shellcheck source=lib.sh
source "$HOOKS_DIR/lib.sh"

pass=0
fail=0

assert_eq() {
  local label="$1" expected="$2" actual="$3"
  if [[ "$expected" == "$actual" ]]; then
    echo "  PASS  $label"
    pass=$((pass + 1))
  else
    echo "  FAIL  $label"
    echo "        expected: $expected"
    echo "        actual:   $actual"
    fail=$((fail + 1))
  fi
}

assert_contains() {
  local label="$1" needle="$2" haystack="$3"
  if [[ "$haystack" == *"$needle"* ]]; then
    echo "  PASS  $label"
    pass=$((pass + 1))
  else
    echo "  FAIL  $label (missing: $needle)"
    fail=$((fail + 1))
  fi
}

assert_empty() {
  local label="$1" actual="$2"
  if [[ -z "$actual" ]]; then
    echo "  PASS  $label"
    pass=$((pass + 1))
  else
    echo "  FAIL  $label (expected empty, got: $actual)"
    fail=$((fail + 1))
  fi
}

run_hook() {
  local hook="$1"
  local payload="$2"
  printf '%s' "$payload" | "$HOOKS_DIR/$hook"
}

echo "=== package_for_path ==="
assert_eq "relative api" "api" "$(package_for_path 'apps/api/src/index.ts')"
assert_eq "absolute web" "web" "$(package_for_path "$REPO_ROOT/apps/web/src/app/page.tsx")"
assert_eq "shared" "shared" "$(package_for_path 'packages/shared/src/index.ts')"
assert_eq "unknown path" "" "$(package_for_path 'docker-compose.yml')"

echo ""
echo "=== extract_file_path ==="
payload='{"tool_input":{"file_path":"apps/api/src/index.ts"}}'
assert_eq "tool_input.file_path" "apps/api/src/index.ts" "$(extract_file_path "$payload")"

echo ""
echo "=== session isolation ==="
SESSION_A="test-isolation-a-$$"
SESSION_B="test-isolation-b-$$"

run_hook after-file-edit.sh "{\"session_id\":\"$SESSION_A\",\"tool_input\":{\"file_path\":\"apps/api/src/index.ts\"}}"
run_hook after-file-edit.sh "{\"session_id\":\"$SESSION_B\",\"tool_input\":{\"file_path\":\"apps/web/src/app/page.tsx\"}}"

set_hook_context "{\"session_id\":\"$SESSION_A\"}"
pkgs_a=$(read_tracked_packages | tr '\n' ',' | sed 's/,$//')
set_hook_context "{\"session_id\":\"$SESSION_B\"}"
pkgs_b=$(read_tracked_packages | tr '\n' ',' | sed 's/,$//')

assert_eq "session A packages" "api" "$pkgs_a"
assert_eq "session B packages" "web" "$pkgs_b"

echo ""
echo "=== sessionStart clears state ==="
run_hook session-start.sh "{\"session_id\":\"$SESSION_A\"}"
set_hook_context "{\"session_id\":\"$SESSION_A\"}"
assert_empty "touched cleared after sessionStart" "$(read_tracked_packages || true)"

echo ""
echo "=== debounce skips rapid re-runs ==="
SESSION_DEBOUNCE="test-debounce-$$"
DEBOUNCE_PAYLOAD="{\"session_id\":\"$SESSION_DEBOUNCE\",\"tool_input\":{\"file_path\":\"packages/shared/src/index.ts\"}}"
run_hook after-file-edit.sh "$DEBOUNCE_PAYLOAD" >/dev/null 2>&1
before=$(cat "${TMPDIR:-/tmp}/travel-claude-hooks/$SESSION_DEBOUNCE/debounce-shared" 2>/dev/null || echo "missing")
run_hook after-file-edit.sh "$DEBOUNCE_PAYLOAD" >/dev/null 2>&1
after=$(cat "${TMPDIR:-/tmp}/travel-claude-hooks/$SESSION_DEBOUNCE/debounce-shared" 2>/dev/null || echo "missing")
assert_eq "debounce stamp unchanged on skip" "$before" "$after"

echo ""
echo "=== stop hook: stop_hook_active guard (no re-block) ==="
SESSION_LOOP="test-stop-loop-$$"
run_hook after-file-edit.sh "{\"session_id\":\"$SESSION_LOOP\",\"tool_input\":{\"file_path\":\"packages/shared/src/index.ts\"}}" >/dev/null 2>&1
out=$(run_hook stop-typecheck-followup.sh "{\"session_id\":\"$SESSION_LOOP\",\"stop_hook_active\":true}" || true)
assert_empty "no block when stop_hook_active=true" "$out"

echo ""
echo "=== stop hook: failure followup ==="
FAIL_DIR=$(mktemp -d)
trap 'rm -rf "$FAIL_DIR"' EXIT
mkdir -p "$FAIL_DIR/apps/api"
printf '%s\n' '{"name":"fail-api","scripts":{"type-check":"echo TS9999: intentional test failure >&2; exit 1"}}' > "$FAIL_DIR/apps/api/package.json"
SESSION_FAIL="test-stop-fail-$$"
(cd "$FAIL_DIR" && git init -q)
run_hook after-file-edit.sh "{\"session_id\":\"$SESSION_FAIL\",\"tool_input\":{\"file_path\":\"apps/api/src/index.ts\"}}" >/dev/null 2>&1
PROJECT_ROOT="$FAIL_DIR"
sleep 1
out=$(cd "$FAIL_DIR" && run_hook stop-typecheck-followup.sh "{\"session_id\":\"$SESSION_FAIL\",\"stop_hook_active\":false}" || true)
assert_contains "decision=block emitted" '"decision": "block"' "$out"
assert_contains "mentions failure" "TS9999" "$out"

echo ""
echo "=== cleanup test state dirs ==="
rm -rf "${TMPDIR:-/tmp}/travel-claude-hooks/test-"* 2>/dev/null || true

echo ""
echo "================================"
echo "Results: $pass passed, $fail failed"
if [[ "$fail" -gt 0 ]]; then
  exit 1
fi
echo "All hook tests passed."
