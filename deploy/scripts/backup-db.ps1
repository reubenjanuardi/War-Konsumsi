# ==============================================================================
# WAR KONSUMSI — DATABASE BACKUP SCRIPT (POWERSHELL / WINDOWS / LARAGON)
# ==============================================================================
# Usage:
#   powershell -ExecutionPolicy Bypass -File deploy/scripts/backup-db.ps1
# ==============================================================================

param(
  [string]$DbName = "war_konsumsi",
  [string]$DbUser = "postgres",
  [string]$DbHost = "127.0.0.1",
  [string]$DbPort = "5432",
  [string]$BackupDir = "./backups"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $BackupDir)) {
  New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}

$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupFile = Join-Path $BackupDir "${DbName}_backup_${Timestamp}.dump"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Starting PostgreSQL Backup for '${DbName}'" -ForegroundColor Cyan
Write-Host "Timestamp: $Timestamp" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# Find pg_dump executable (check PATH and standard Laragon locations)
$pgDump = "pg_dump"
if (-not (Get-Command pg_dump -ErrorAction SilentlyContinue)) {
  $laragonPg = "C:\laragon\bin\postgresql\postgresql-17.10\bin\pg_dump.exe"
  if (Test-Path $laragonPg) {
    $pgDump = $laragonPg
  }
}

& $pgDump -h $DbHost -p $DbPort -U $DbUser -d $DbName -Fc -f $BackupFile

if (Test-Path $BackupFile) {
  $size = (Get-Item $BackupFile).Length / 1KB
  Write-Host "==> Backup successful!" -ForegroundColor Green
  Write-Host "    Path: $BackupFile" -ForegroundColor Green
  Write-Host "    Size: $([math]::Round($size, 2)) KB" -ForegroundColor Green
} else {
  Write-Error "Backup file was not created!"
}
