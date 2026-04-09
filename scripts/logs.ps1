# Mythoria Admin Portal - Logs Viewer Script
# This script displays logs from the Cloud Run service

param(
    [Parameter(Mandatory = $false)]
    [ValidateSet("staging", "production")]
    [string]$Environment = "production",
    
    [Parameter(Mandatory = $false)]
    [string]$ProjectId = "oceanic-beach-460916-n5",
    
    [Parameter(Mandatory = $false)]
    [string]$Region = "europe-west9",
    
    [Parameter(Mandatory = $false)]
    [int]$Lines = 50,
    
    [Parameter(Mandatory = $false)]
    [switch]$Follow,

    [Parameter(Mandatory = $false)]
    [int]$Hours = 24,

    [Parameter(Mandatory = $false)]
    [string]$Format = "table(timestamp,severity,textPayload)"
)

$ErrorActionPreference = "Stop"

Write-Host "[INFO] Viewing logs for Mythoria Admin Portal"
Write-Host "[INFO] Environment: $Environment"
Write-Host "[INFO] Project: $ProjectId"
Write-Host "[INFO] Region: $Region"

try {
    # Set the project
    if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
        throw "gcloud is not installed or not available on PATH"
    }

    gcloud config set project $ProjectId --quiet

    # Determine service name
    $serviceName = if ($Environment -eq "staging") { "mythoria-admin-staging" } else { "mythoria-admin" }
    
    Write-Host "[INFO] Viewing logs for service: $serviceName"
    Write-Host "[INFO] Last $Hours hours"
    Write-Host "[INFO] Limit: $Lines entries"
    
    if ($Follow) {
        Write-Host "[INFO] Following logs (Press Ctrl+C to stop)..."
        gcloud beta logging tail "resource.type=cloud_run_revision AND resource.labels.service_name=$serviceName AND resource.labels.location=$Region" --project=$ProjectId
    }
    else {
        $startTime = (Get-Date).AddHours(-1 * $Hours).ToString("o")
        gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=$serviceName AND resource.labels.location=$Region AND timestamp>=\"$startTime\"" --project=$ProjectId --limit=$Lines --format="$Format"
    }

}
catch {
    Write-Host "[ERR] Failed to view logs: $($_.Exception.Message)"
    exit 1
}

Write-Host "[OK] Logs viewing completed"