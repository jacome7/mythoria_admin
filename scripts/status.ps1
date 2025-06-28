# Mythoria Admin Portal - Cloud Run Status Script
# This script checks the status of the admin portal deployment

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("staging", "production")]
    [string]$Environment = "production",
    
    [Parameter(Mandatory=$false)]
    [string]$ProjectId = "oceanic-beach-460916-n5",
    
    [Parameter(Mandatory=$false)]
    [string]$Region = "europe-west9"
)

$ErrorActionPreference = "Stop"

Write-Host "[INFO] Checking Mythoria Admin Portal status"
Write-Host "[INFO] Environment: $Environment"
Write-Host "[INFO] Project: $ProjectId"
Write-Host "[INFO] Region: $Region"

try {
    # Set the project
    gcloud config set project $ProjectId --quiet

    # Determine service name
    $serviceName = if ($Environment -eq "staging") { "mythoria-admin-staging" } else { "mythoria-admin" }
    
    Write-Host "[INFO] Checking service: $serviceName"
    
    # Get service status
    $serviceInfo = gcloud run services describe $serviceName --region=$Region --format=json 2>$null
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERR] Service $serviceName not found or not accessible"
        exit 1
    }
    
    $serviceData = $serviceInfo | ConvertFrom-Json
    
    # Display service information
    Write-Host "[OK] Service found: $serviceName"
    Write-Host "[INFO] URL: $($serviceData.status.url)"
    Write-Host "[INFO] Ready: $($serviceData.status.conditions | Where-Object {$_.type -eq 'Ready'} | Select-Object -ExpandProperty status)"
    Write-Host "[INFO] CPU: $($serviceData.spec.template.spec.template.spec.containers[0].resources.limits.cpu)"
    Write-Host "[INFO] Memory: $($serviceData.spec.template.spec.template.spec.containers[0].resources.limits.memory)"
    Write-Host "[INFO] Min Instances: $($serviceData.spec.template.spec.template.metadata.annotations.'autoscaling.knative.dev/minScale')"
    Write-Host "[INFO] Max Instances: $($serviceData.spec.template.spec.template.metadata.annotations.'autoscaling.knative.dev/maxScale')"
    
    # Get recent revisions
    Write-Host "[INFO] Recent revisions:"
    gcloud run revisions list --service=$serviceName --region=$Region --limit=3 --format="table(metadata.name,status.conditions[0].status,metadata.creationTimestamp)"
    
    # Test the service
    Write-Host "[INFO] Testing service connectivity..."
    try {
        $response = Invoke-WebRequest -Uri $serviceData.status.url -TimeoutSec 10 -UseBasicParsing
        Write-Host "[OK] Service is responding (Status: $($response.StatusCode))"
    } catch {
        Write-Host "[WARN] Service may not be responding: $($_.Exception.Message)"
    }

} catch {
    Write-Host "[ERR] Status check failed: $($_.Exception.Message)"
    exit 1
}

Write-Host "[OK] Status check completed"
