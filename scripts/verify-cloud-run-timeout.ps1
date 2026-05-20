# Verifies Cloud Run request timeout after deploy.

param(
    [Parameter(Mandatory = $false)]
    [string]$ServiceName = "mythoria-admin",

    [Parameter(Mandatory = $false)]
    [string]$Region = "europe-west9",

    [Parameter(Mandatory = $false)]
    [int]$ExpectedTimeoutSeconds = 3600
)

$ErrorActionPreference = "Stop"
$global:PSNativeCommandUseErrorActionPreference = $false

Write-Host "[INFO] Verifying Cloud Run timeout for $ServiceName in $Region..."

$actualTimeout = gcloud run services describe $ServiceName --region=$Region --format="value(spec.template.spec.timeoutSeconds)" 2>$null
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($actualTimeout)) {
    Write-Host "[ERR] Could not read Cloud Run timeout for $ServiceName"
    exit 1
}

$actualTimeoutSeconds = [int]$actualTimeout
if ($actualTimeoutSeconds -ne $ExpectedTimeoutSeconds) {
    Write-Host "[ERR] Cloud Run timeout drift detected for $ServiceName"
    Write-Host "  - Expected: $ExpectedTimeoutSeconds seconds"
    Write-Host "  - Actual: $actualTimeoutSeconds seconds"
    exit 1
}

Write-Host "[OK] Cloud Run timeout verified: $actualTimeoutSeconds seconds"
