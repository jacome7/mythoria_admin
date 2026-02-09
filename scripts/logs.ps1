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
    [switch]$Follow
)

$ErrorActionPreference = "Stop"

Write-Host "[INFO] Viewing logs for Mythoria Admin Portal"
Write-Host "[INFO] Environment: $Environment"
Write-Host "[INFO] Project: $ProjectId"
Write-Host "[INFO] Region: $Region"

try {
    # Set the project
    gcloud config set project $ProjectId --quiet

    # Determine service name
    $serviceName = if ($Environment -eq "staging") { "mythoria-admin-staging" } else { "mythoria-admin" }
    
    Write-Host "[INFO] Viewing logs for service: $serviceName"
    Write-Host "[INFO] Last $Lines lines"
    
    if ($Follow) {
        Write-Host "[INFO] Following logs (Press Ctrl+C to stop)..."
        gcloud run services logs tail $serviceName --region=$Region --project=$ProjectId
    }
    else {
        gcloud run services logs read $serviceName --region=$Region --project=$ProjectId --limit=$Lines --format="table(timestamp,severity,textPayload)"
    }

}
catch {
    Write-Host "[ERR] Failed to view logs: $($_.Exception.Message)"
    exit 1
}

Write-Host "[OK] Logs viewing completed"
