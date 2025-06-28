# Mythoria Admin Portal - Environment Setup Script
# This script sets up the Google Cloud environment for the admin portal

param(
    [Parameter(Mandatory=$false)]
    [string]$ProjectId = "oceanic-beach-460916-n5",
    
    [Parameter(Mandatory=$false)]
    [string]$Region = "europe-west9"
)

$ErrorActionPreference = "Stop"

Write-Host "[INFO] Setting up Google Cloud environment for Mythoria Admin Portal"
Write-Host "[INFO] Project: $ProjectId"
Write-Host "[INFO] Region: $Region"

try {
    # Set the project
    Write-Host "[INFO] Setting project..."
    gcloud config set project $ProjectId --quiet
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERR] Failed to set project"
        exit 1
    }
    Write-Host "[OK] Project set to $ProjectId"

    # Enable required APIs
    Write-Host "[INFO] Enabling required APIs..."
    $apis = @(
        "cloudbuild.googleapis.com",
        "run.googleapis.com", 
        "containerregistry.googleapis.com",
        "secretmanager.googleapis.com",
        "sql-component.googleapis.com",
        "sqladmin.googleapis.com"
    )

    foreach ($api in $apis) {
        Write-Host "[INFO] Enabling $api..."
        gcloud services enable $api --quiet
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[WARN] Failed to enable $api - may already be enabled"
        } else {
            Write-Host "[OK] Enabled $api"
        }
    }

    # Check Cloud Build service account permissions
    Write-Host "[INFO] Checking Cloud Build service account..."
    $projectNumber = gcloud projects describe $ProjectId --format="value(projectNumber)"
    $cloudbuildSA = "$projectNumber@cloudbuild.gserviceaccount.com"
    
    Write-Host "[INFO] Cloud Build Service Account: $cloudbuildSA"
    
    # Grant necessary roles to Cloud Build service account
    $roles = @(
        "roles/run.admin",
        "roles/storage.admin",
        "roles/secretmanager.secretAccessor"
    )
    
    foreach ($role in $roles) {
        Write-Host "[INFO] Granting $role to Cloud Build SA..."
        gcloud projects add-iam-policy-binding $ProjectId --member="serviceAccount:$cloudbuildSA" --role=$role --quiet
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[OK] Granted $role"
        } else {
            Write-Host "[WARN] Could not grant $role - may already exist"
        }
    }

    # Check if Cloud SQL instance exists
    Write-Host "[INFO] Checking Cloud SQL instances..."
    $sqlInstances = gcloud sql instances list --format="value(name)" 2>$null
    if ($sqlInstances) {
        Write-Host "[OK] Found Cloud SQL instances:"
        $sqlInstances | ForEach-Object { Write-Host "[INFO]   - $_" }
    } else {
        Write-Host "[WARN] No Cloud SQL instances found"
    }

    # List existing secrets
    Write-Host "[INFO] Checking Secret Manager secrets..."
    $secrets = gcloud secrets list --format="value(name)" 2>$null
    if ($secrets) {
        Write-Host "[OK] Found secrets:"
        $secrets | ForEach-Object { Write-Host "[INFO]   - $_" }
    } else {
        Write-Host "[WARN] No secrets found in Secret Manager"
    }

    # Set default region for Cloud Run
    Write-Host "[INFO] Setting default region for Cloud Run..."
    gcloud config set run/region $Region --quiet
    Write-Host "[OK] Default Cloud Run region set to $Region"

} catch {
    Write-Host "[ERR] Environment setup failed: $($_.Exception.Message)"
    exit 1
}

Write-Host "[OK] Environment setup completed successfully"
Write-Host "[INFO] You can now run the deployment script: .\scripts\deploy.ps1"
