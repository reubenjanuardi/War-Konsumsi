#!/usr/bin/env bash
# ==============================================================================
# WAR KONSUMSI — DATABASE RESTORE SCRIPT
# ==============================================================================
# Restores a PostgreSQL dump created with pg_dump -Fc.
#
# Usage:
#   bash deploy/scripts/restore-db.sh <path-to-dump-file>
#
# Example:
#   bash deploy/scripts/restore-db.sh ./backups/war_konsumsi_backup_20260915_120000.dump
# ==============================================================================

set -euo pipefail

DB_NAME="${PGDATABASE:-war_konsumsi}"
DB_USER="${PGUSER:-postgres}"
DB_HOST="${PGHOST:-127.0.0.1}"
DB_PORT="${PGPORT:-5432}"

if [ $# -lt 1 ]; then
  echo "Usage: $0 <path-to-dump-file>"
  echo ""
  echo "Available backups in ./backups:"
  ls -lh ./backups/*.dump 2>/dev/null || echo "No .dump files found in ./backups"
  exit 1
fi

DUMP_FILE="$1"

if [ ! -f "${DUMP_FILE}" ]; then
  echo "ERROR: Backup file '${DUMP_FILE}' does not exist!" >&2
  exit 1
fi

CONTAINER_NAME="${CONTAINER_NAME:-war_konsumsi_db_prod}"
USE_DOCKER="${USE_DOCKER:-auto}"

# Auto-detect docker container
if [ "${USE_DOCKER}" = "auto" ]; then
  if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    USE_DOCKER="true"
  else
    USE_DOCKER="false"
  fi
fi

if [ "${USE_DOCKER}" = "true" ]; then
  TARGET_DESC="Docker Container '${CONTAINER_NAME}' as user '${DB_USER}'"
else
  TARGET_DESC="${DB_HOST}:${DB_PORT} as ${DB_USER}"
fi

echo "=========================================================="
echo "WARNING: RESTORING DATABASE"
echo "Database:  ${DB_NAME}"
echo "Dump File: ${DUMP_FILE}"
echo "Target:    ${TARGET_DESC}"
echo "=========================================================="
echo "This operation will overwrite or replace data in '${DB_NAME}'."
read -p "Are you sure you want to proceed? (Type 'YES' to confirm): " CONFIRM

if [ "${CONFIRM}" != "YES" ]; then
  echo "Restore cancelled by user."
  exit 0
fi

echo "==> Starting pg_restore..."
# --clean: clean (drop) database objects prior to recreating them
# --if-exists: do not error if object to drop does not exist
# --no-owner: do not output commands to set ownership of objects
# --no-privileges: prevent restoration of access privileges
if [ "${USE_DOCKER}" = "true" ]; then
  echo "    Executing pg_restore inside Docker container '${CONTAINER_NAME}'..."
  cat "${DUMP_FILE}" | docker exec -i "${CONTAINER_NAME}" pg_restore \
    -U "${DB_USER}" \
    -d "${DB_NAME}" \
    --clean \
    --if-exists \
    --no-owner \
    --no-privileges \
    -v || {
      STATUS=$?
      if [ $STATUS -eq 1 ]; then
        echo "Note: pg_restore completed with minor warnings (exit code 1)."
      else
        echo "ERROR: pg_restore failed with exit code $STATUS" >&2
        exit $STATUS
      fi
    }
else
  echo "    Executing host pg_restore against ${DB_HOST}:${DB_PORT}..."
  pg_restore \
    -h "${DB_HOST}" \
    -p "${DB_PORT}" \
    -U "${DB_USER}" \
    -d "${DB_NAME}" \
    --clean \
    --if-exists \
    --no-owner \
    --no-privileges \
    -v \
    "${DUMP_FILE}" || {
      # pg_restore returns non-zero warnings on harmless warnings like 'table exists'
      STATUS=$?
      if [ $STATUS -eq 1 ]; then
        echo "Note: pg_restore completed with minor warnings (exit code 1)."
      else
        echo "ERROR: pg_restore failed with exit code $STATUS" >&2
        exit $STATUS
      fi
    }
fi

echo "==> Database restore completed successfully!"
