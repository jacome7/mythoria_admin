# Mythoria Admin Portal - Production Deployment Script
# This script deploys the admin portal to Google Cloud Run

param(
    [switch]$Force = $false,
    [switch]$Verbose = $false
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

# Set project
Write-Host "[INFO] Setting project to $PROJECT_ID..."
gcloud config set project $PROJECT_ID

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERR] Failed to set project. Please check your authentication."
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

# Deploy using Cloud Build with beta for enhanced logging
Write-Host "[INFO] Starting Cloud Build deployment with enhanced logging..."
Write-Host "[INFO] This may take several minutes..."

if ($Verbose) {
    gcloud beta builds submit --config cloudbuild.yaml --verbosity=debug
} else {
    gcloud beta builds submit --config cloudbuild.yaml
}

if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] Deployment completed successfully!"
    Write-Host "[INFO] Getting service URL..."
    
    $serviceUrl = gcloud run services describe $SERVICE_NAME --region=$REGION --format="value(status.url)" 2>$null
    if ($serviceUrl) {
        Write-Host "[OK] Service URL: $serviceUrl"
    } else {
        Write-Host "[WARN] Could not retrieve service URL. Check Cloud Console."
    }
    
    Write-Host "[INFO] Deployment summary:"
    Write-Host "  - Service: $SERVICE_NAME"
    Write-Host "  - Region: $REGION"
    Write-Host "  - URL: $serviceUrl"
} else {
    Write-Host "[ERR] Deployment failed. Check the logs above for details."
    exit 1
}
