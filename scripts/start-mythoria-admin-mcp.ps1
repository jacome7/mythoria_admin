[CmdletBinding()]
param(
  [string]$SecretName = "MCP_SECRET_KEY",
  [string]$ProjectId = "",
  [string]$Endpoint = "https://mythoria-admin-803421888801.europe-west9.run.app/api/mcp"
)

$ErrorActionPreference = "Stop"

if (-not $ProjectId) {
  $ProjectId = $env:GOOGLE_CLOUD_PROJECT
}
if (-not $ProjectId) {
  $ProjectId = (gcloud config get-value project 2>$null).Trim()
}
if (-not $ProjectId) {
  throw "Could not resolve Google Cloud project. Set -ProjectId, GOOGLE_CLOUD_PROJECT, or gcloud config default project."
}

$secret = (& gcloud --project $ProjectId secrets versions access latest --secret $SecretName 2>$null).Trim()
if (-not $secret) {
  throw "Unable to load MCP secret from Secret Manager. Ensure gcloud auth is valid and secret '$SecretName' exists."
}

$env:MYTHORIA_ADMIN_MCP_SECRET = $secret

& npx -y mcp-remote@0.1.38 $Endpoint --transport sse-only --header "Authorization: Bearer ${MYTHORIA_ADMIN_MCP_SECRET}"
