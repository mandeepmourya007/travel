#!/usr/bin/env bash
set -euo pipefail

# Manual OTP smoke test — sends an OTP to a phone number and reports which
# channel actually delivered it (sms/whatsapp/mock), using the live local API.
# Usage: ./scripts/test-otp.sh

API_URL="${API_URL:-http://localhost:4001/api/v1}"

read -rp "📱 Enter 10-digit Indian phone number: " PHONE

if [[ ! "$PHONE" =~ ^[6-9][0-9]{9}$ ]]; then
  echo "❌ Invalid phone — must be 10 digits starting with 6-9 (e.g. 9876543210)"
  exit 1
fi

echo ""
echo "📤 Sending OTP to $PHONE..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/auth/otp/send" \
  -H "Content-Type: application/json" \
  -d "{\"phone\": \"$PHONE\"}")

BODY=$(echo "$RESPONSE" | sed '$d')
STATUS=$(echo "$RESPONSE" | tail -1)

echo ""
echo "── Response (HTTP $STATUS) ──────────────────────────"
echo "$BODY" | (command -v jq >/dev/null && jq . || cat)
echo "──────────────────────────────────────────────────────"

if [ "$STATUS" != "200" ]; then
  echo "❌ Send failed — check API logs: docker compose logs api --tail 30"
  exit 1
fi

CHANNEL=$(echo "$BODY" | (command -v jq >/dev/null && jq -r '.data.channel // .channel // "unknown"' || echo "unknown"))
echo ""
echo "✅ OTP dispatched via channel: $CHANNEL"
echo ""

read -rp "🔢 Enter the OTP you received (or press Enter to skip verify): " OTP

if [ -n "$OTP" ]; then
  echo ""
  echo "📥 Verifying OTP..."
  VERIFY_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/auth/otp/verify" \
    -H "Content-Type: application/json" \
    -d "{\"phone\": \"$PHONE\", \"otp\": \"$OTP\"}")

  VERIFY_BODY=$(echo "$VERIFY_RESPONSE" | sed '$d')
  VERIFY_STATUS=$(echo "$VERIFY_RESPONSE" | tail -1)

  echo ""
  echo "── Verify Response (HTTP $VERIFY_STATUS) ────────────"
  echo "$VERIFY_BODY" | (command -v jq >/dev/null && jq . || cat)
  echo "──────────────────────────────────────────────────────"

  if [ "$VERIFY_STATUS" = "200" ]; then
    echo ""
    echo "✅ OTP verified successfully!"
  else
    echo ""
    echo "❌ Verification failed"
  fi
else
  echo "⏭️  Skipped verification"
fi
