# Mythoria Admin Portal - Production Deployment Script
# This script deploys the admin portal to Google Cloud Run

param(
    [Parameter(Mandatory=$false)]
    [string]$ProjectId = "oceanic-beach-460916-n5",
    
    [Parameter(Mandatory=$false)]
    [string]$Region = "europe-west9",
    
    [switch]$Force = $false,
    [switch]$Verbose = $false
)

# Set error action preference
$ErrorActionPreference = "Stop"

Write-Host "[INFO] Starting production deployment of Mythoria Admin Portal"
Write-Host "[INFO] Project: $ProjectId"
Write-Host "[INFO] Region: $Region"

try {
    # Configuration
    $SERVICE_NAME = "mythoria-admin"
    
    Write-Host "[INFO] Project: $ProjectId"
    Write-Host "[INFO] Service: $SERVICE_NAME"
    Write-Host "[INFO] Region: $Region"
    
    # Check if gcloud is installed
    Write-Host "[INFO] Checking gcloud installation..."
    $gcloudVersion = gcloud version --format="value(Google Cloud SDK)" 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERR] gcloud CLI not found. Please install Google Cloud SDK."
        exit 1
    }
    Write-Host "[OK] Google Cloud SDK found: $gcloudVersion"

    # Set the project
    Write-Host "[INFO] Setting Google Cloud project..."
    gcloud config set project $ProjectId
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERR] Failed to set project"
        exit 1
    }
    Write-Host "[OK] Project set to $ProjectId"

    # Check authentication
    Write-Host "[INFO] Checking authentication..."
    $account = gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>$null
    if ([string]::IsNullOrEmpty($account)) {
        Write-Host "[WARN] Not authenticated. Running gcloud auth login..."
        gcloud auth login
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[ERR] Authentication failed"
            exit 1
        }
    }
    Write-Host "[OK] Authenticated as: $account"

    # Enable required APIs
    Write-Host "[INFO] Enabling required Google Cloud APIs..."
    $apis = @(
        "cloudbuild.googleapis.com",
        "run.googleapis.com",
        "containerregistry.googleapis.com"
    )
    
    foreach ($api in $apis) {
        Write-Host "[INFO] Enabling $api..."
        gcloud services enable $api --quiet
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[ERR] Failed to enable $api"
            exit 1
        }
    }
    Write-Host "[OK] All APIs enabled"

    # Confirm deployment
    if (-not $Force) {
        $confirmation = Read-Host "Deploy to production? [y/N]"
        if ($confirmation -ne 'y' -and $confirmation -ne 'Y') {
            Write-Host "[INFO] Deployment cancelled by user."
            exit 0
        }
    }

    # Build and deploy using beta for enhanced logging
    Write-Host "[INFO] Starting Cloud Build production deployment with enhanced logging..."
    Write-Host "[INFO] This may take several minutes..."
    
    if ($Verbose) {
        gcloud beta builds submit --config cloudbuild.yaml --verbosity=debug
    } else {
        gcloud beta builds submit --config cloudbuild.yaml
    }
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERR] Deployment failed"
        exit 1
    }

    # Get the service URL
    Write-Host "[INFO] Getting service URL..."
    $serviceUrl = gcloud run services describe $SERVICE_NAME --region=$Region --format="value(status.url)" 2>$null
    
    if ([string]::IsNullOrEmpty($serviceUrl)) {
        Write-Host "[WARN] Could not retrieve service URL"
    } else {
        Write-Host "[OK] Deployment successful!"
        Write-Host "[OK] Service URL: $serviceUrl"
        Write-Host "[INFO] Admin Portal is now accessible at the URL above"
        Write-Host "[INFO] Deployment summary:"
        Write-Host "  - Service: $SERVICE_NAME"
        Write-Host "  - Region: $Region"
        Write-Host "  - URL: $serviceUrl"
    }

} catch {
    Write-Host "[ERR] Deployment failed with error: $($_.Exception.Message)"
    exit 1
}

Write-Host "[OK] Deployment script completed successfully"
