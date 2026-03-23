#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-https://servertest-vq85.onrender.com}"
COUNT="${2:-500}"
PASSWORD="${3:-SuperSecurePass123!}"

echo "Starting bulk registration"
echo "Base URL: $BASE_URL"
echo "Users: $COUNT"
echo

# generate random string
rand_str() {
  openssl rand -hex 4
}

for i in $(seq 1 "$COUNT"); do
  TS=$(date +%s%N)                  # nanosecond timestamp
  RAND=$(rand_str)

  USERNAME="user_${RAND}_${i}"
  EMAIL="user_${RAND}_${TS}_${i}@example.com"

  echo "[$i/$COUNT] $EMAIL"

  RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "$BASE_URL/auth/register" \
    -H "Content-Type: application/json" \
    -d "{
      \"email\": \"$EMAIL\",
      \"username\": \"$USERNAME\",
      \"password\": \"$PASSWORD\"
    }"
  )

  if [[ "$RESPONSE" == "200" ]]; then
    echo "success"
  elif [[ "$RESPONSE" == "409" ]]; then
    echo " duplicate (should be rare)"
  else
    echo " failed (HTTP $RESPONSE)"
  fi

  # small delay so you don't nuke your DB / Render limits
  sleep 0.05
done

echo
echo "Done"
