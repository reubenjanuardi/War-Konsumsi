#!/usr/bin/env bash
# ==============================================================================
# WAR KONSUMSI — AUTOMATED DATABASE BACKUP SCRIPT
# ==============================================================================
# Creates a compressed, transactionally consistent PostgreSQL dump.
#
# Usage:
#   bash deploy/scripts/backup-db.sh
#
# Can be run manually or automated via cron:
#   # Run every hour during event day:
#   0 * * * * /bin/bash /path/to/War-Konsumsi/deploy/scripts/backup-db.sh >> /var/log/war-konsumsi-backup.log 2>&1
# ==============================================================================

set -euo pipefail

# 1. Configuration
BACKUP_DIR="${BACKUP_DIR:-./backups}"
DB_NAME="${PGDATABASE:-${POSTGRES_DB:-war_konsumsi}}"
DB_USER="${PGUSER:-${POSTGRES_USER:-postgres}}"
DB_HOST="${PGHOST:-127.0.0.1}"
DB_PORT="${PGPORT:-5432}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
CONTAINER_NAME="${CONTAINER_NAME:-war_konsumsi_db_prod}"
USE_DOCKER="${USE_DOCKER:-auto}"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_backup_${TIMESTAMP}.dump"

echo "=========================================================="
echo "Starting PostgreSQL Backup for '${DB_NAME}'"
echo "Timestamp: ${TIMESTAMP}"
echo "=========================================================="

# Auto-detect docker container
if [ "${USE_DOCKER}" = "auto" ]; then
  if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    USE_DOCKER="true"
  else
    USE_DOCKER="false"
  fi
fi

# 2. Ensure backup directory exists on host (artifacts stored outside container)
mkdir -p "${BACKUP_DIR}"

# 3. Execute pg_dump
# -Fc uses PostgreSQL Custom compressed format (flexible, restorable with pg_restore)
# -Z 6 sets standard gzip level compression inside dump
echo "==> Running pg_dump..."
if [ "${USE_DOCKER}" = "true" ]; then
  echo "    Executing pg_dump inside Docker container '${CONTAINER_NAME}'..."
  docker exec -i "${CONTAINER_NAME}" pg_dump \
    -U "${DB_USER}" \
    -d "${DB_NAME}" \
    -Fc > "${BACKUP_FILE}"
else
  echo "    Executing host pg_dump against ${DB_HOST}:${DB_PORT}..."
  pg_dump \
    -h "${DB_HOST}" \
    -p "${DB_PORT}" \
    -U "${DB_USER}" \
    -d "${DB_NAME}" \
    -Fc \
    -f "${BACKUP_FILE}"
fi

# 4. Verify file was created and is non-empty
if [ -s "${BACKUP_FILE}" ]; then
  FILE_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
  echo "==> Backup successful!"
  echo "    Path: ${BACKUP_FILE}"
  echo "    Size: ${FILE_SIZE}"
else
  echo "ERROR: Backup file is empty or was not created!" >&2
  exit 1
fi

# 5. Clean up old backups older than RETENTION_DAYS
echo "==> Cleaning up backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -name "${DB_NAME}_backup_*.dump" -mtime +"${RETENTION_DAYS}" -type f -exec rm -v {} \; || true

echo "==> Backup process complete."
