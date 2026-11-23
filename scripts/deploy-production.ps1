# Mythoria Admin Portal - Production Deployment Script
# This script deploys the admin portal to Google Cloud Run

param(
    [switch]$Force = $false,
    [switch]$Verbose = $false,
    [switch]$ReferralMcp = $false
)

# Configuration
$PROJECT_ID = "oceanic-beach-460916-n5"
$SERVICE_NAME = "mythoria-admin"
$REGION = "europe-west9"

Write-Host "[INFO] Starting Mythoria Admin Portal deployment..."
Write-Host "[INFO] Project: $PROJECT_ID"
Write-Host "[INFO] Service: $SERVICE_NAME"
Write-Host "[INFO] Region: $REGION"

# Check if gcloud is installed
try {
    $gcloudVersion = gcloud version --format="value(Google Cloud SDK)" 2>$null
    Write-Host "[OK] Google Cloud SDK found: $gcloudVersion"
} catch {
    Write-Host "[ERR] Google Cloud SDK not found. Please install gcloud CLI."
    exit 1
}

# Confirm deployment
if (-not $Force) {
    $confirmation = Read-Host "Deploy to production? This will update the live service. [y/N]"
    if ($confirmation -ne 'y' -and $confirmation -ne 'Y') {
        Write-Host "[INFO] Deployment cancelled by user."
        exit 0
    }
}

# Use the same image-release path for both production entry points.
$deployParams = @{
    ProjectId = $PROJECT_ID
    Region = $REGION
    Fast = $true
    ReferralMcp = $ReferralMcp
    VerboseLogging = $Verbose
}
& (Join-Path $PSScriptRoot 'deploy.ps1') @deployParams
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

& (Join-Path $PSScriptRoot 'verify-cloud-run-timeout.ps1') -ServiceName $SERVICE_NAME -Region $REGION -ExpectedTimeoutSeconds 300
exit $LASTEXITCODE
