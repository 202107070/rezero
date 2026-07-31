#!/bin/sh
set -eu

VALKEY_DIR="${VALKEY_DIR:-/data}"
VALKEY_PORT="${REDIS_PORT:-6379}"

mkdir -p "$VALKEY_DIR"

# game.Dockerfile로 빌드된 컨테이너에서 Valkey를 Node 앱과 함께 기동합니다.
valkey-server \
  --daemonize yes \
  --bind 0.0.0.0 \
  --port "$VALKEY_PORT" \
  --dir "$VALKEY_DIR" \
  --appendonly yes \
  --protected-mode no

i=0
while [ "$i" -lt 50 ]; do
  if valkey-cli -p "$VALKEY_PORT" ping 2>/dev/null | grep -q PONG; then
    echo "[Valkey] ready on 0.0.0.0:${VALKEY_PORT}"
    exec node app.js
  fi
  i=$((i + 1))
  sleep 0.1
done

echo "[Valkey] failed to start" >&2
exit 1
