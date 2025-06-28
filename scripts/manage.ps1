# Mythoria Admin Portal - Management Script
# This master script provides easy access to all deployment operations

param(
    [Parameter(Mandatory=$true, Position=0)]
    [ValidateSet("setup", "deploy", "status", "logs", "help")]
    [string]$Action,
    
    [Parameter(Mandatory=$false)]
    [ValidateSet("staging", "production")]
    [string]$Environment = "production",
    
    [Parameter(Mandatory=$false)]
    [switch]$Follow
)

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Definition
$ErrorActionPreference = "Stop"

function Show-Help {
    Write-Host ""
    Write-Host "Mythoria Admin Portal Management Script"
    Write-Host "======================================="
    Write-Host ""
    Write-Host "Usage: .\manage.ps1 <action> [options]"
    Write-Host ""
    Write-Host "Actions:"
    Write-Host "  setup      - Set up Google Cloud environment"
    Write-Host "  deploy     - Deploy the admin portal"
    Write-Host "  status     - Check deployment status"
    Write-Host "  logs       - View service logs"
    Write-Host "  help       - Show this help message"
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  -Environment <staging|production>  - Target environment (default: production)"
    Write-Host "  -Follow                            - Follow logs in real-time (logs action only)"
    Write-Host ""
    Write-Host "Examples:"
    Write-Host "  .\manage.ps1 setup"
    Write-Host "  .\manage.ps1 deploy -Environment staging"
    Write-Host "  .\manage.ps1 status"
    Write-Host "  .\manage.ps1 logs -Follow"
    Write-Host ""
}

try {
    switch ($Action) {
        "setup" {
            Write-Host "[INFO] Running environment setup..."
            & "$scriptPath\setup-environment.ps1"
        }
        
        "deploy" {
            Write-Host "[INFO] Running deployment for $Environment environment..."
            & "$scriptPath\deploy.ps1" -Environment $Environment
        }
        
        "status" {
            Write-Host "[INFO] Checking status for $Environment environment..."
            & "$scriptPath\status.ps1" -Environment $Environment
        }
        
        "logs" {
            Write-Host "[INFO] Viewing logs for $Environment environment..."
            if ($Follow) {
                & "$scriptPath\logs.ps1" -Environment $Environment -Follow
            } else {
                & "$scriptPath\logs.ps1" -Environment $Environment
            }
        }
        
        "help" {
            Show-Help
        }
        
        default {
            Write-Host "[ERR] Unknown action: $Action"
            Show-Help
            exit 1
        }
    }
} catch {
    Write-Host "[ERR] Management script failed: $($_.Exception.Message)"
    exit 1
}

Write-Host "[OK] Management script completed"
