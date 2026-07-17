# cleanup-old-images.ps1
# Deletes container images from Google Container Registry older than specified days
# Usage: .\cleanup-old-images.ps1 -DaysOld 7 -ProjectId "oceanic-beach-460916-n5" -ServiceName "mythoria-admin"

param(
  [Parameter(Mandatory = $false)]
  [int]$DaysOld = 7,
    
  [Parameter(Mandatory = $false)]
  [string]$ProjectId = "oceanic-beach-460916-n5",
    
  [Parameter(Mandatory = $false)]
  [string]$ServiceName = "mythoria-admin",
    
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

Write-Host "=== Cloud Run Image Cleanup ===" -ForegroundColor Cyan
Write-Host "Project: $ProjectId" -ForegroundColor White
Write-Host "Service: $ServiceName" -ForegroundColor White
Write-Host "Deleting images older than: $DaysOld days" -ForegroundColor White
Write-Host "Dry run: $($DryRun.IsPresent)" -ForegroundColor White
Write-Host ""

# Calculate cutoff date
$cutoffDate = (Get-Date).AddDays(-$DaysOld).ToString("yyyy-MM-ddTHH:mm:ss")
Write-Host "Cutoff date: $cutoffDate" -ForegroundColor Yellow
Write-Host ""

# List all images with their creation time
Write-Host "Fetching images from gcr.io/$ProjectId/$ServiceName..." -ForegroundColor Cyan
$images = Invoke-GcloudJson `
  -Arguments @(
    "container",
    "images",
    "list-tags",
    "gcr.io/$ProjectId/$ServiceName",
    "--format=json",
    "--filter=timestamp.datetime < '$cutoffDate'"
  ) `
  -FailureMessage "Error fetching images. Check your repository name, project, permissions, and gcloud authentication."

if ($images.Count -eq 0) {
  Write-Host "No images found older than $DaysOld days. Nothing to clean up!" -ForegroundColor Green
  exit 0
}

Write-Host "Found $($images.Count) image(s) to delete:" -ForegroundColor Yellow
Write-Host ""

$totalSize = 0
foreach ($image in $images) {
  $digest = $image.digest
  $timestamp = $image.timestamp
  $tags = if ($image.tags) { $image.tags -join ", " } else { "untagged" }
    
  Write-Host "  - Digest: $digest" -ForegroundColor White
  Write-Host "    Created: $timestamp" -ForegroundColor Gray
  Write-Host "    Tags: $tags" -ForegroundColor Gray
  Write-Host ""
}

if ($DryRun) {
  Write-Host "DRY RUN - No images were deleted." -ForegroundColor Yellow
  Write-Host "Remove -DryRun flag to actually delete these images." -ForegroundColor Yellow
  exit 0
}

# Confirm deletion
Write-Host "WARNING: This will permanently delete $($images.Count) image(s)!" -ForegroundColor Red
$confirmation = Read-Host "Type 'DELETE' to confirm"

if ($confirmation -ne "DELETE") {
  Write-Host "Cancelled. No images were deleted." -ForegroundColor Yellow
  exit 0
}

Write-Host ""
Write-Host "Deleting images..." -ForegroundColor Cyan

$deletedCount = 0
$failedCount = 0

foreach ($image in $images) {
  $digest = $image.digest
  $imageRef = "gcr.io/$ProjectId/${ServiceName}@$digest"
    
  Write-Host "Deleting: $imageRef" -ForegroundColor Gray
    
  gcloud container images delete $imageRef --quiet --project=$ProjectId 2>&1 | Out-Null
    
  if ($LASTEXITCODE -eq 0) {
    $deletedCount++
    Write-Host "  [OK] Deleted" -ForegroundColor Green
  }
  else {
    $failedCount++
    Write-Host "  [FAIL] Failed" -ForegroundColor Red
  }
}

Write-Host ""
Write-Host "=== Summary ===" -ForegroundColor Cyan
Write-Host "Successfully deleted: $deletedCount image(s)" -ForegroundColor Green
if ($failedCount -gt 0) {
  Write-Host "Failed to delete: $failedCount image(s)" -ForegroundColor Red
}

Write-Host ""
Write-Host "Done! Container registry storage has been reduced." -ForegroundColor Green
Write-Host "Note: Billing updates may take a few hours to reflect." -ForegroundColor Gray
