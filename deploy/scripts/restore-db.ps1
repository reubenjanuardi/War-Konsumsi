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
  [string]$DbPort = "5432",
  [string]$ContainerName = "war_konsumsi_db_prod",
  [string]$UseDocker = "auto"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $DumpFile)) {
  Write-Error "Backup file '$DumpFile' does not exist!"
}

# Detect if container is active
$isContainerRunning = $false
if ($UseDocker -eq "true" -or $UseDocker -eq "auto") {
  if (Get-Command docker -ErrorAction SilentlyContinue) {
    $runningContainers = docker ps --format "{{.Names}}" 2>$null
    if ($runningContainers -contains $ContainerName) {
      $isContainerRunning = $true
    }
  }
}

$targetDesc = if ($isContainerRunning) { "Docker Container '$ContainerName' as $DbUser" } else { "${DbHost}:${DbPort} as $DbUser" }

Write-Host "==========================================================" -ForegroundColor Yellow
Write-Host "WARNING: RESTORING DATABASE" -ForegroundColor Yellow
Write-Host "Database:  $DbName" -ForegroundColor Yellow
Write-Host "Dump File: $DumpFile" -ForegroundColor Yellow
Write-Host "Target:    $targetDesc" -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Yellow

if ($isContainerRunning) {
  Write-Host "==> Executing pg_restore inside Docker container '$ContainerName'..." -ForegroundColor Cyan
  Get-Content -Path $DumpFile -AsByteStream | docker exec -i $ContainerName pg_restore -U $DbUser -d $DbName --clean --if-exists --no-owner --no-privileges -v
} else {
  $pgRestore = "pg_restore"
  if (-not (Get-Command pg_restore -ErrorAction SilentlyContinue)) {
    $laragonPg = "C:\laragon\bin\postgresql\postgresql-17.10\bin\pg_restore.exe"
    if (Test-Path $laragonPg) {
      $pgRestore = $laragonPg
    }
  }

  Write-Host "==> Executing host pg_restore against ${DbHost}:${DbPort}..." -ForegroundColor Cyan
  & $pgRestore -h $DbHost -p $DbPort -U $DbUser -d $DbName --clean --if-exists --no-owner --no-privileges -v $DumpFile
}

Write-Host "==> Database restore completed successfully!" -ForegroundColor Green
