#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-https://servertest-vq85.onrender.com}"
COUNT="${2:-50}"
PREFIX="${3:-loadtest}"
PASSWORD="${4:-SuperSecurePass123!}"

echo "Base URL: $BASE_URL"
echo "Count: $COUNT"
echo "Prefix: $PREFIX"

for i in $(seq 1 "$COUNT"); do
  EMAIL="${PREFIX}${i}@example.com"
  USERNAME="${PREFIX}${i}"

  echo "[$i/$COUNT] Registering $EMAIL"

  RESPONSE=$(
    curl -sS -X POST "$BASE_URL/auth/register" \
      -H "Content-Type: application/json" \
      -d "{
        \"email\": \"$EMAIL\",
        \"username\": \"$USERNAME\",
        \"password\": \"$PASSWORD\"
      }"
  )

  echo "$RESPONSE"
  sleep 0.1
done
