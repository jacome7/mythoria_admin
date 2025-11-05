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
$imagesJson = gcloud container images list-tags "gcr.io/$ProjectId/$ServiceName" --format=json --filter="timestamp.datetime < '$cutoffDate'" 2>&1

if ($LASTEXITCODE -ne 0) {
  Write-Host "Error fetching images. Make sure you're authenticated with gcloud." -ForegroundColor Red
  Write-Host "Run: gcloud auth login" -ForegroundColor Yellow
  exit 1
}

$images = $imagesJson | ConvertFrom-Json

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
    
  Write-Host "  • Digest: $digest" -ForegroundColor White
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
