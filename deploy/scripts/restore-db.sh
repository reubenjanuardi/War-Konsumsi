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

echo "=========================================================="
echo "WARNING: RESTORING DATABASE"
echo "Database:  ${DB_NAME}"
echo "Dump File: ${DUMP_FILE}"
echo "Target:    ${DB_HOST}:${DB_PORT} as ${DB_USER}"
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

echo "==> Database restore completed successfully!"
