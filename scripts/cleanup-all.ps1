# cleanup-all.ps1
# Runs both image and revision cleanup scripts
# Usage: .\cleanup-all.ps1 -DaysOld 7 -KeepRevisions 5 -DryRun

param(
  [Parameter(Mandatory = $false)]
  [int]$DaysOld = 7,
    
  [Parameter(Mandatory = $false)]
  [int]$KeepRevisions = 5,
    
  [Parameter(Mandatory = $false)]
  [string]$ProjectId = "oceanic-beach-460916-n5",
    
  [Parameter(Mandatory = $false)]
  [string]$ServiceName = "mythoria-admin",
    
  [Parameter(Mandatory = $false)]
  [string]$Region = "europe-west9",
    
  [Parameter(Mandatory = $false)]
  [switch]$DryRun
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "    Mythoria Cloud Run Complete Cleanup Script         " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

$params = @{
  ProjectId   = $ProjectId
  ServiceName = $ServiceName
}

if ($DryRun) {
  $params.DryRun = $true
}

# Step 1: Clean up old revisions
Write-Host "STEP 1: Cleaning up old Cloud Run revisions" -ForegroundColor Magenta
Write-Host "--------------------------------------------" -ForegroundColor Magenta
Write-Host ""

& "$scriptDir\cleanup-old-revisions.ps1" @params -KeepRevisions $KeepRevisions -Region $Region

Write-Host ""
Write-Host ""

# Step 2: Clean up old images
Write-Host "STEP 2: Cleaning up old container images" -ForegroundColor Magenta
Write-Host "--------------------------------------------" -ForegroundColor Magenta
Write-Host ""

& "$scriptDir\cleanup-old-images.ps1" @params -DaysOld $DaysOld

Write-Host ""
Write-Host ""
Write-Host "========================================================" -ForegroundColor Green
Write-Host "              Cleanup Complete!                         " -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green
Write-Host ""

if (-not $DryRun) {
  Write-Host "Tip: You can schedule this script to run automatically using Windows Task Scheduler" -ForegroundColor Yellow
  Write-Host "Example: Run weekly with -DaysOld 7 -KeepRevisions 5" -ForegroundColor Gray
}
