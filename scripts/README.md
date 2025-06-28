# Mythoria Admin Portal - Deployment Scripts

This directory contains PowerShell scripts for managing the Mythoria Admin Portal deployment on Google Cloud Run.

## Scripts Overview

### `manage.ps1` - Master Management Script
The main script that provides easy access to all operations.

```powershell
# Set up Google Cloud environment
.\scripts\manage.ps1 setup

# Deploy to production
.\scripts\manage.ps1 deploy

# Deploy to staging
.\scripts\manage.ps1 deploy -Environment staging

# Check deployment status
.\scripts\manage.ps1 status

# View logs
.\scripts\manage.ps1 logs

# Follow logs in real-time
.\scripts\manage.ps1 logs -Follow

# Show help
.\scripts\manage.ps1 help
```

### Individual Scripts

#### `setup-environment.ps1`
- Enables required Google Cloud APIs
- Sets up IAM permissions for Cloud Build
- Configures default regions
- Checks existing resources (Cloud SQL, secrets)

#### `deploy.ps1`
- Builds and deploys the admin portal
- Supports both staging and production environments
- Provides deployment status and service URL

#### `status.ps1`
- Shows current deployment status
- Displays service configuration
- Lists recent revisions
- Tests service connectivity

#### `logs.ps1`
- Views Cloud Run service logs
- Supports following logs in real-time
- Configurable number of log lines

## Quick Start

1. **First-time setup:**
   ```powershell
   .\scripts\manage.ps1 setup
   ```

2. **Deploy to production:**
   ```powershell
   .\scripts\manage.ps1 deploy
   ```

3. **Check if deployment is successful:**
   ```powershell
   .\scripts\manage.ps1 status
   ```

## Configuration

All scripts use these default values:
- **Project ID**: `oceanic-beach-460916-n5`
- **Region**: `europe-west9`
- **Service Name**: `mythoria-admin` (production) / `mythoria-admin-staging` (staging)

## Prerequisites

- Google Cloud SDK (gcloud) installed and configured
- PowerShell 5.1 or higher
- Appropriate permissions in the Google Cloud project

## Troubleshooting

### Authentication Issues
```powershell
gcloud auth login
gcloud config set project oceanic-beach-460916-n5
```

### API Not Enabled
The setup script will automatically enable required APIs:
- Cloud Build API
- Cloud Run API
- Container Registry API
- Secret Manager API
- Cloud SQL Admin API

### Permission Issues
The setup script grants necessary roles to the Cloud Build service account:
- `roles/run.admin`
- `roles/storage.admin`
- `roles/secretmanager.secretAccessor`

## Security Notes

- All scripts use the existing service account and secrets
- The admin portal is deployed with public access (`--allow-unauthenticated`)
- Authentication will be handled at the application level in Phase 4

## Resource Configuration

### Production Environment
- Memory: 512Mi
- CPU: 1
- Min instances: 0
- Max instances: 5
- Concurrency: 80

### Staging Environment
- Memory: 512Mi
- CPU: 1
- Min instances: 0
- Max instances: 5
- Concurrency: 80
