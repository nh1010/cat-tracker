#!/bin/sh
set -e

echo "=== Cat Tracker Startup ==="
echo "APP_ENV=${APP_ENV}"
echo "PORT=${PORT}"
echo "SQLITE_DB_PATH=${SQLITE_DB_PATH}"
echo "DATABASE_URL=${DATABASE_URL:-<not set, using sqlite>}"
echo "S3_BUCKET=${S3_BUCKET:-<not set>}"
echo "PWD=$(pwd)"

echo ""
echo "--- Running alembic upgrade head ---"
alembic upgrade head
echo "--- Alembic done ---"

echo ""
echo "--- Starting uvicorn on port ${PORT} ---"
exec uvicorn src.main:app --host 0.0.0.0 --port "${PORT:-5000}"
