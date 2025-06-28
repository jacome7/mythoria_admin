# Mythoria Admin Portal - Deployment Script
# This script deploys the admin portal to Google Cloud Run

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("staging", "production")]
    [string]$Environment = "production",
    
    [Parameter(Mandatory=$false)]
    [string]$ProjectId = "oceanic-beach-460916-n5",
    
    [Parameter(Mandatory=$false)]
    [string]$Region = "europe-west9"
)

# Set error action preference
$ErrorActionPreference = "Stop"

Write-Host "[INFO] Starting deployment of Mythoria Admin Portal"
Write-Host "[INFO] Environment: $Environment"
Write-Host "[INFO] Project: $ProjectId"
Write-Host "[INFO] Region: $Region"

try {
    # Check if gcloud is installed
    Write-Host "[INFO] Checking gcloud installation..."
    $gcloudVersion = gcloud version 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERR] gcloud CLI not found. Please install Google Cloud SDK."
        exit 1
    }
    Write-Host "[OK] gcloud CLI found"

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

    # Build and deploy
    if ($Environment -eq "staging") {
        Write-Host "[INFO] Deploying to staging environment..."
        gcloud builds submit --config cloudbuild-staging.yaml
    } else {
        Write-Host "[INFO] Deploying to production environment..."
        gcloud builds submit --config cloudbuild.yaml
    }
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERR] Deployment failed"
        exit 1
    }

    # Get the service URL
    Write-Host "[INFO] Getting service URL..."
    $serviceName = if ($Environment -eq "staging") { "mythoria-admin-staging" } else { "mythoria-admin" }
    $serviceUrl = gcloud run services describe $serviceName --region=$Region --format="value(status.url)" 2>$null
    
    if ([string]::IsNullOrEmpty($serviceUrl)) {
        Write-Host "[WARN] Could not retrieve service URL"
    } else {
        Write-Host "[OK] Deployment successful!"
        Write-Host "[INFO] Service URL: $serviceUrl"
        Write-Host "[INFO] Admin Portal is now accessible at the URL above"
    }

} catch {
    Write-Host "[ERR] Deployment failed with error: $($_.Exception.Message)"
    exit 1
}

Write-Host "[OK] Deployment script completed successfully"
