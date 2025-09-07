# Mythoria Admin Portal - Production Deployment Script
# This script deploys the admin portal to Google Cloud Run

param(
    [Parameter(Mandatory=$false)]
    [string]$ProjectId = "oceanic-beach-460916-n5",
    
    [Parameter(Mandatory=$false)]
    [string]$Region = "europe-west9",
    
    [switch]$Force = $false,
    [switch]$VerboseLogging = $false,
    [switch]$Fast = $false
)

# Set error action preference
$ErrorActionPreference = "Stop"
# In PowerShell 7+, prevent native commands writing to stderr from honoring ErrorActionPreference
$global:PSNativeCommandUseErrorActionPreference = $false

Write-Host "[INFO] Starting production deployment of Mythoria Admin Portal"
Write-Host "[INFO] Project: $ProjectId"
Write-Host "[INFO] Region: $Region"

try {
    # Configuration
    $SERVICE_NAME = "mythoria-admin"
    $IMAGE_NAME = "gcr.io/$ProjectId/$SERVICE_NAME"
    
    Write-Host "[INFO] Project: $ProjectId"
    Write-Host "[INFO] Service: $SERVICE_NAME"
    Write-Host "[INFO] Region: $Region"
    
    # Check if gcloud is installed
    Write-Host "[INFO] Checking gcloud installation..."
    $gcloudPath = Get-Command gcloud -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Source
    if (-not $gcloudPath) {
        Write-Host "[ERR] gcloud CLI not found. Please install Google Cloud SDK." -ForegroundColor Red
        exit 1
    }
    Write-Host "[OK] Google Cloud SDK found at: $gcloudPath"

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

    if ($Fast) {
        Write-Host "[INFO] Fast deploy: reusing last built image" -ForegroundColor Yellow
        $digest = (gcloud container images list-tags $IMAGE_NAME --format="get(digest)" --limit=1 --sort-by=~timestamp 2>$null)
        if (-not $digest) {
            Write-Host "[ERR] No prior image found for $IMAGE_NAME. Fast deploy requires an existing image." -ForegroundColor Red
            exit 1
        }
        $imageRef = "$IMAGE_NAME@sha256:$digest"
        Write-Host "[INFO] Deploying $imageRef to $SERVICE_NAME in $Region" -ForegroundColor Cyan
        gcloud run deploy $SERVICE_NAME --image $imageRef --region $Region --platform managed --quiet
    } else {
        function Invoke-NpmCiWithRecovery {
            param([int]$MaxAttempts = 2)
            $attempt = 1
            while ($attempt -le $MaxAttempts) {
                Write-Host "[INFO] Installing dependencies (npm ci) - attempt $attempt/$MaxAttempts" -ForegroundColor Blue
                npm ci
                if ($LASTEXITCODE -eq 0) { return $true }

                Write-Host "[WARN] npm ci failed (exit $LASTEXITCODE). Attempting recovery..." -ForegroundColor Yellow
                # Try to rename node_modules to free locks, then remove
                if (Test-Path -Path "node_modules") {
                    $timestamp = Get-Date -Format "yyyyMMddHHmmss"
                    $backupDir = "node_modules_old_$timestamp"
                    try { Rename-Item -Path "node_modules" -NewName $backupDir -ErrorAction Stop } catch {}
                    # Try remove old dir in background best-effort
                    try { Start-Job -ScriptBlock { param($p) Remove-Item -LiteralPath $p -Recurse -Force -ErrorAction SilentlyContinue } -ArgumentList (Join-Path (Get-Location) $backupDir) | Out-Null } catch {}
                }
                Start-Sleep -Seconds 2
                $attempt++
            }
            return $false
        }

        # Install dependencies; prefer ci if lockfile exists, otherwise fallback to install
        if (Test-Path -Path "package-lock.json") {
            $ciOk = Invoke-NpmCiWithRecovery -MaxAttempts 1
            if (-not $ciOk) {
                Write-Host "[WARN] Falling back to 'npm install' after npm ci failures" -ForegroundColor Yellow
                npm install --no-fund --no-audit
                if ($LASTEXITCODE -ne 0) { Write-Host "[ERR] npm install failed" -ForegroundColor Red; exit 1 }
            }
        } else {
            Write-Host "[INFO] No package-lock.json found; installing dependencies (npm install)" -ForegroundColor Yellow
            npm install --no-fund --no-audit
            if ($LASTEXITCODE -ne 0) { Write-Host "[ERR] npm install failed" -ForegroundColor Red; exit 1 }
        }
        Write-Host "[INFO] Linting (npm run lint)" -ForegroundColor Blue
        npm run lint
        if ($LASTEXITCODE -ne 0) { Write-Host "[ERR] Lint failed" -ForegroundColor Red; exit 1 }
        Write-Host "[INFO] Typecheck (npm run typecheck)" -ForegroundColor Blue
        npm run typecheck
        if ($LASTEXITCODE -ne 0) { Write-Host "[ERR] Typecheck failed" -ForegroundColor Red; exit 1 }
        Write-Host "[INFO] Tests (npm test)" -ForegroundColor Blue
        npm test
        if ($LASTEXITCODE -ne 0) { Write-Host "[ERR] Tests failed" -ForegroundColor Red; exit 1 }
        Write-Host "[INFO] Building (npm run build)" -ForegroundColor Blue
        npm run build
        if ($LASTEXITCODE -ne 0) { Write-Host "[ERR] Build failed" -ForegroundColor Red; exit 1 }
        # Build and deploy with Cloud Build (cloudbuild.yaml)
        Write-Host "[INFO] Starting Cloud Build production deployment..."
        Write-Host "[INFO] This may take several minutes..."
        
        if ($VerboseLogging) {
            gcloud beta builds submit --config cloudbuild.yaml --verbosity=debug
        } else {
            gcloud beta builds submit --config cloudbuild.yaml
        }
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
