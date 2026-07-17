# cleanup-old-revisions.ps1
# Deletes old Cloud Run service revisions
# Usage: .\cleanup-old-revisions.ps1 -KeepRevisions 5 -ProjectId "oceanic-beach-460916-n5" -ServiceName "mythoria-admin" -Region "europe-west9"

param(
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

function Get-GcloudCommand {
  $command = Get-Command gcloud.cmd -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }

  $command = Get-Command gcloud -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }

  Write-Host "gcloud was not found on PATH. Install the Google Cloud SDK or add it to PATH." -ForegroundColor Red
  exit 1
}

function Invoke-GcloudJson {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Arguments,

    [Parameter(Mandatory = $true)]
    [string]$FailureMessage
  )

  $stderrPath = [System.IO.Path]::GetTempFileName()

  try {
    $gcloudCommand = Get-GcloudCommand
    $stdout = & $gcloudCommand @Arguments 2> $stderrPath
    $exitCode = $LASTEXITCODE
    $stderr = Get-Content -Path $stderrPath -Raw -ErrorAction SilentlyContinue

    if ($exitCode -ne 0) {
      Write-Host $FailureMessage -ForegroundColor Red
      if (-not [string]::IsNullOrWhiteSpace($stderr)) {
        Write-Host $stderr.Trim() -ForegroundColor Red
      }
      exit $exitCode
    }

    if ([string]::IsNullOrWhiteSpace(($stdout -join "`n"))) {
      if (-not [string]::IsNullOrWhiteSpace($stderr)) {
        Write-Host $FailureMessage -ForegroundColor Red
        Write-Host $stderr.Trim() -ForegroundColor Red
        exit 1
      }

      return @()
    }

    try {
      return ($stdout | ConvertFrom-Json)
    }
    catch {
      Write-Host "gcloud returned output that was not valid JSON." -ForegroundColor Red
      Write-Host "Raw output:" -ForegroundColor Red
      Write-Host ($stdout -join "`n") -ForegroundColor Red
      if (-not [string]::IsNullOrWhiteSpace($stderr)) {
        Write-Host "Error output:" -ForegroundColor Red
        Write-Host $stderr.Trim() -ForegroundColor Red
      }
      exit 1
    }
  }
  finally {
    Remove-Item -Path $stderrPath -Force -ErrorAction SilentlyContinue
  }
}

Write-Host "=== Cloud Run Revision Cleanup ===" -ForegroundColor Cyan
Write-Host "Project: $ProjectId" -ForegroundColor White
Write-Host "Service: $ServiceName" -ForegroundColor White
Write-Host "Region: $Region" -ForegroundColor White
Write-Host "Keeping most recent: $KeepRevisions revision(s)" -ForegroundColor White
Write-Host "Dry run: $($DryRun.IsPresent)" -ForegroundColor White
Write-Host ""

# List all revisions
Write-Host "Fetching revisions for $ServiceName..." -ForegroundColor Cyan
$revisions = Invoke-GcloudJson `
  -Arguments @(
    "run",
    "revisions",
    "list",
    "--service=$ServiceName",
    "--region=$Region",
    "--project=$ProjectId",
    "--format=json",
    "--sort-by=~metadata.creationTimestamp"
  ) `
  -FailureMessage "Error fetching revisions. Check your service name, project, region, permissions, and gcloud authentication."

if ($revisions.Count -eq 0) {
  Write-Host "No revisions found for service $ServiceName." -ForegroundColor Yellow
  exit 0
}

Write-Host "Total revisions found: $($revisions.Count)" -ForegroundColor White

if ($revisions.Count -le $KeepRevisions) {
  Write-Host "Only $($revisions.Count) revision(s) exist. Keeping all revisions." -ForegroundColor Green
  exit 0
}

# Determine which revisions to delete (skip the most recent ones)
$revisionsToDelete = $revisions | Select-Object -Skip $KeepRevisions

Write-Host ""
Write-Host "Revisions to delete: $($revisionsToDelete.Count)" -ForegroundColor Yellow
Write-Host ""

foreach ($revision in $revisionsToDelete) {
  $name = $revision.metadata.name
  $created = $revision.metadata.creationTimestamp
  $traffic = if ($revision.status.traffic) { "$($revision.status.traffic)%" } else { "0%" }
    
  Write-Host "  - $name" -ForegroundColor White
  Write-Host "    Created: $created" -ForegroundColor Gray
  Write-Host "    Traffic: $traffic" -ForegroundColor Gray
  Write-Host ""
}

if ($DryRun) {
  Write-Host "DRY RUN - No revisions were deleted." -ForegroundColor Yellow
  Write-Host "Remove -DryRun flag to actually delete these revisions." -ForegroundColor Yellow
  exit 0
}

# Confirm deletion
Write-Host "WARNING: This will delete $($revisionsToDelete.Count) old revision(s)!" -ForegroundColor Red
$confirmation = Read-Host "Type 'DELETE' to confirm"

if ($confirmation -ne "DELETE") {
  Write-Host "Cancelled. No revisions were deleted." -ForegroundColor Yellow
  exit 0
}

Write-Host ""
Write-Host "Deleting revisions..." -ForegroundColor Cyan

$deletedCount = 0
$failedCount = 0

foreach ($revision in $revisionsToDelete) {
  $name = $revision.metadata.name
    
  Write-Host "Deleting: $name" -ForegroundColor Gray
    
  gcloud run revisions delete $name --region=$Region --project=$ProjectId --quiet 2>&1 | Out-Null
    
  if ($LASTEXITCODE -eq 0) {
    $deletedCount++
    Write-Host "  [OK] Deleted" -ForegroundColor Green
  }
  else {
    $failedCount++
    Write-Host "  [FAIL] Failed (may be serving traffic)" -ForegroundColor Red
  }
}

Write-Host ""
Write-Host "=== Summary ===" -ForegroundColor Cyan
Write-Host "Successfully deleted: $deletedCount revision(s)" -ForegroundColor Green
if ($failedCount -gt 0) {
  Write-Host "Failed to delete: $failedCount revision(s)" -ForegroundColor Red
  Write-Host "Note: Revisions serving traffic cannot be deleted." -ForegroundColor Gray
}

Write-Host ""
Write-Host "Done!" -ForegroundColor Green
