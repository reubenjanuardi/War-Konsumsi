# ==============================================================================
# WAR KONSUMSI — DATABASE RESTORE SCRIPT (POWERSHELL / WINDOWS / LARAGON)
# ==============================================================================
# Usage:
#   powershell -ExecutionPolicy Bypass -File deploy/scripts/restore-db.ps1 -DumpFile <path>
# ==============================================================================

param(
  [Parameter(Mandatory=$true)]
  [string]$DumpFile,
  [string]$DbName = "war_konsumsi",
  [string]$DbUser = "postgres",
  [string]$DbHost = "127.0.0.1",
  [string]$DbPort = "5432"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $DumpFile)) {
  Write-Error "Backup file '$DumpFile' does not exist!"
}

Write-Host "==========================================================" -ForegroundColor Yellow
Write-Host "WARNING: RESTORING DATABASE" -ForegroundColor Yellow
Write-Host "Database:  $DbName" -ForegroundColor Yellow
Write-Host "Dump File: $DumpFile" -ForegroundColor Yellow
Write-Host "Target:    ${DbHost}:${DbPort} as $DbUser" -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Yellow

$pgRestore = "pg_restore"
if (-not (Get-Command pg_restore -ErrorAction SilentlyContinue)) {
  $laragonPg = "C:\laragon\bin\postgresql\postgresql-17.10\bin\pg_restore.exe"
  if (Test-Path $laragonPg) {
    $pgRestore = $laragonPg
  }
}

& $pgRestore -h $DbHost -p $DbPort -U $DbUser -d $DbName --clean --if-exists --no-owner --no-privileges -v $DumpFile

Write-Host "==> Database restore completed successfully!" -ForegroundColor Green
