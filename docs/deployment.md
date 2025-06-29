# Mythoria Admin Portal - Deployment Guide

## Overview

This guide covers the deployment process for the Mythoria Admin Portal to Google Cloud Platform using Cloud Run. The application is containerized and deployed using Google Cloud Build for automated CI/CD.

## Deployment Architecture

### Infrastructure Overview
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Developer     │───►│  Cloud Source    │───►│  Cloud Build    │
│   (git push)    │    │  Repository      │    │   (CI/CD)       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Cloud Run     │◄───│  Container       │◄───│  Docker Build   │
│   (Production)  │    │  Registry        │    │   Process       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │
         ▼
┌─────────────────┐    ┌──────────────────┐
│   Cloud SQL     │    │   VPC Network    │
│  (Databases)    │    │  (Connectivity)  │
└─────────────────┘    └──────────────────┘
```

### Deployment Configuration
- **Platform**: Google Cloud Run
- **Region**: europe-west9 (Paris)
- **Project**: oceanic-beach-460916-n5
- **Service Name**: mythoria-admin
- **Container Registry**: Google Container Registry (GCR)

## Prerequisites

### 1. Google Cloud Setup
- Google Cloud Platform account with billing enabled
- Project created: `oceanic-beach-460916-n5`
- Required APIs enabled:
  - Cloud Run API
  - Cloud Build API
  - Container Registry API
  - Cloud SQL API

### 2. Local Development Environment
- Google Cloud SDK installed and configured
- Docker installed (for local testing)
- Git repository access
- Environment variables configured

### 3. Database Infrastructure
- Cloud SQL PostgreSQL instance running
- VPC network configured for private connectivity
- Database schemas deployed:
  - `mythoria_db`
  - `workflows_db`
  - `backoffice_db`

## Deployment Files

### 1. Dockerfile
```dockerfile
# Multi-stage build for production optimization
FROM node:22.12-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
RUN npm ci --only=production && npm cache clean --force

# Build the application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build Next.js application
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

### 2. Cloud Build Configuration (`cloudbuild.yaml`)
```yaml
steps:
  # Build the Docker image
  - name: 'gcr.io/cloud-builders/docker'
    args: 
      - 'build'
      - '-t'
      - 'gcr.io/$PROJECT_ID/mythoria-admin:$COMMIT_SHA'
      - '-t'
      - 'gcr.io/$PROJECT_ID/mythoria-admin:latest'
      - '.'

  # Push the Docker image to Container Registry
  - name: 'gcr.io/cloud-builders/docker'
    args: 
      - 'push'
      - 'gcr.io/$PROJECT_ID/mythoria-admin:$COMMIT_SHA'

  - name: 'gcr.io/cloud-builders/docker'
    args: 
      - 'push'
      - 'gcr.io/$PROJECT_ID/mythoria-admin:latest'

  # Deploy to Cloud Run
  - name: 'gcr.io/cloud-builders/gcloud'
    args:
      - 'run'
      - 'deploy'
      - 'mythoria-admin'
      - '--image=gcr.io/$PROJECT_ID/mythoria-admin:$COMMIT_SHA'
      - '--region=europe-west9'
      - '--platform=managed'
      - '--allow-unauthenticated'
      - '--memory=512Mi'
      - '--cpu=1'
      - '--min-instances=0'
      - '--max-instances=5'
      - '--port=3000'
      - '--vpc-connector=projects/$PROJECT_ID/locations/europe-west9/connectors/mythoria-vpc-connector'
      - '--vpc-egress=private-ranges-only'
      - '--set-env-vars=NODE_ENV=production'
      - '--set-env-vars=NEXTAUTH_URL=https://mythoria-admin-$PROJECT_ID-europe-west9.a.run.app'
      - '--set-secrets=AUTH_SECRET=auth-secret:latest'
      - '--set-secrets=GOOGLE_CLIENT_ID=google-client-id:latest'
      - '--set-secrets=GOOGLE_CLIENT_SECRET=google-client-secret:latest'
      - '--set-secrets=DB_HOST=db-host:latest'
      - '--set-secrets=DB_PORT=db-port:latest'
      - '--set-secrets=DB_USER=db-user:latest'
      - '--set-secrets=DB_PASSWORD=db-password:latest'
      - '--set-env-vars=MYTHORIA_DB_NAME=mythoria_db'
      - '--set-env-vars=WORKFLOWS_DB_NAME=workflows_db'
      - '--set-env-vars=BACKOFFICE_DB_NAME=backoffice_db'

# Build timeout
timeout: '1200s'

# Build options
options:
  machineType: 'E2_HIGHCPU_8'
  logging: CLOUD_LOGGING_ONLY
```

### 3. Next.js Configuration (`next.config.ts`)
```typescript
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable standalone output for containerized deployment
  output: 'standalone',
  
  // Environment variables validation
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
  
  // Disable telemetry in production
  telemetry: false,
  
  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ];
  },
  
  // Experimental features
  experimental: {
    // Enable React Server Components
    serverComponentsExternalPackages: ['@google-cloud/storage'],
  },
};

export default nextConfig;
```

## Environment Configuration

### 1. Production Environment Variables

#### Cloud Run Environment Variables
```bash
# Application Configuration
NODE_ENV=production
PORT=3000
HOSTNAME=0.0.0.0

# NextAuth Configuration
NEXTAUTH_URL=https://mythoria-admin-oceanic-beach-460916-n5-europe-west9.a.run.app

# Database Configuration
MYTHORIA_DB_NAME=mythoria_db
WORKFLOWS_DB_NAME=workflows_db
BACKOFFICE_DB_NAME=backoffice_db
```

#### Google Secret Manager Secrets
```bash
# Authentication Secrets
AUTH_SECRET=<generated-secret-key>
GOOGLE_CLIENT_ID=<google-oauth-client-id>
GOOGLE_CLIENT_SECRET=<google-oauth-client-secret>

# Database Connection Secrets
DB_HOST=<cloud-sql-private-ip>
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=<database-password>
```

### 2. Secret Management

#### Create Secrets in Google Secret Manager
```bash
# Create authentication secret
echo -n "your-super-secret-auth-key" | gcloud secrets create auth-secret --data-file=-

# Create Google OAuth secrets
echo -n "your-google-client-id" | gcloud secrets create google-client-id --data-file=-
echo -n "your-google-client-secret" | gcloud secrets create google-client-secret --data-file=-

# Create database secrets
echo -n "10.19.192.3" | gcloud secrets create db-host --data-file=-
echo -n "5432" | gcloud secrets create db-port --data-file=-
echo -n "postgres" | gcloud secrets create db-user --data-file=-
echo -n "your-db-password" | gcloud secrets create db-password --data-file=-
```

#### Grant Cloud Run Access to Secrets
```bash
# Get the Cloud Run service account
SERVICE_ACCOUNT=$(gcloud run services describe mythoria-admin --region=europe-west9 --format="value(spec.template.spec.serviceAccountName)")

# Grant access to secrets
gcloud secrets add-iam-policy-binding auth-secret --member="serviceAccount:$SERVICE_ACCOUNT" --role="roles/secretmanager.secretAccessor"
gcloud secrets add-iam-policy-binding google-client-id --member="serviceAccount:$SERVICE_ACCOUNT" --role="roles/secretmanager.secretAccessor"
gcloud secrets add-iam-policy-binding google-client-secret --member="serviceAccount:$SERVICE_ACCOUNT" --role="roles/secretmanager.secretAccessor"
gcloud secrets add-iam-policy-binding db-host --member="serviceAccount:$SERVICE_ACCOUNT" --role="roles/secretmanager.secretAccessor"
gcloud secrets add-iam-policy-binding db-port --member="serviceAccount:$SERVICE_ACCOUNT" --role="roles/secretmanager.secretAccessor"
gcloud secrets add-iam-policy-binding db-user --member="serviceAccount:$SERVICE_ACCOUNT" --role="roles/secretmanager.secretAccessor"
gcloud secrets add-iam-policy-binding db-password --member="serviceAccount:$SERVICE_ACCOUNT" --role="roles/secretmanager.secretAccessor"
```

## Deployment Process

### 1. Automated Deployment (Recommended)

#### Using Cloud Build Trigger
```bash
# Create a Cloud Build trigger
gcloud builds triggers create github \
  --repo-name=Mythoria \
  --repo-owner=your-github-username \
  --branch-pattern="^main$" \
  --build-config=mythoria_admin/cloudbuild.yaml \
  --include-logs-with-status
```

#### Manual Cloud Build Deployment
```bash
# Navigate to project directory
cd c:\Mythoria\mythoria_admin

# Submit build to Cloud Build
gcloud builds submit --config cloudbuild.yaml

# Monitor build progress
gcloud builds list --limit=5
```

### 2. Local Deployment Script

#### PowerShell Deployment Script (`scripts/deploy.ps1`)
```powershell
# Mythoria Admin Portal Deployment Script
param(
    [string]$ProjectId = "oceanic-beach-460916-n5",
    [string]$Region = "europe-west9",
    [string]$ServiceName = "mythoria-admin"
)

Write-Host "🚀 Starting Mythoria Admin Portal Deployment" -ForegroundColor Green

# Set project
Write-Host "📋 Setting project to $ProjectId"
gcloud config set project $ProjectId

# Check if authenticated
$authCheck = gcloud auth list --filter=status:ACTIVE --format="value(account)"
if (-not $authCheck) {
    Write-Host "❌ Not authenticated with Google Cloud" -ForegroundColor Red
    Write-Host "Please run: gcloud auth login"
    exit 1
}

# Submit build
Write-Host "🔨 Submitting build to Cloud Build"
$buildResult = gcloud builds submit --config cloudbuild.yaml

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Deployment completed successfully" -ForegroundColor Green
Write-Host "🌐 Service URL: https://$ServiceName-$ProjectId-$Region.a.run.app"
```

### 3. Database Migration Deployment

#### Pre-Deployment Database Updates
```bash
# Run database migrations before deployment
npm run db:migrate

# Verify database connectivity
npm run db:studio

# Test health endpoint
curl "https://mythoria-admin-oceanic-beach-460916-n5-europe-west9.a.run.app/api/health"
```

## Monitoring and Logging

### 1. Cloud Run Monitoring

#### View Service Logs
```bash
# Stream logs in real-time
gcloud run logs tail mythoria-admin --region=europe-west9

# View recent logs
gcloud run logs read mythoria-admin --region=europe-west9 --limit=50

# Filter logs by severity
gcloud run logs read mythoria-admin --region=europe-west9 --log-filter='severity>=ERROR'
```

#### Monitor Service Metrics
```bash
# Get service details
gcloud run services describe mythoria-admin --region=europe-west9

# View service status
gcloud run services list --filter="metadata.name:mythoria-admin"
```

### 2. Health Monitoring

#### Health Check Endpoint
```bash
# Basic health check
curl "https://mythoria-admin-oceanic-beach-460916-n5-europe-west9.a.run.app/api/health"

# Detailed health check with debug info
curl "https://mythoria-admin-oceanic-beach-460916-n5-europe-west9.a.run.app/api/health?debug=true"
```

#### Monitoring Scripts
```bash
# Create a monitoring script
#!/bin/bash
SERVICE_URL="https://mythoria-admin-oceanic-beach-460916-n5-europe-west9.a.run.app"

# Check health endpoint
HEALTH_STATUS=$(curl -s "$SERVICE_URL/api/health" | jq -r '.status')

if [ "$HEALTH_STATUS" != "healthy" ]; then
    echo "❌ Service unhealthy: $HEALTH_STATUS"
    # Send alert (implement your alerting mechanism)
else
    echo "✅ Service healthy"
fi
```

### 3. Performance Monitoring

#### Cloud Monitoring Setup
```bash
# Create monitoring dashboard
gcloud monitoring dashboards create --config-from-file=monitoring-dashboard.json

# Set up alerting policies
gcloud alpha monitoring policies create --policy-from-file=alerting-policy.json
```

## Scaling and Performance

### 1. Auto-scaling Configuration

#### Cloud Run Scaling Settings
```yaml
# Scaling configuration in cloudbuild.yaml
- '--min-instances=0'      # Scale to zero when no traffic
- '--max-instances=5'      # Maximum 5 instances
- '--cpu=1'                # 1 vCPU per instance
- '--memory=512Mi'         # 512MB memory per instance
- '--concurrency=100'      # 100 concurrent requests per instance
```

#### Custom Scaling Policies
```bash
# Update scaling settings
gcloud run services update mythoria-admin \
  --region=europe-west9 \
  --min-instances=1 \
  --max-instances=10 \
  --cpu=2 \
  --memory=1Gi
```

### 2. Performance Optimization

#### Container Optimization
- **Multi-stage builds** - Reduce image size
- **Standalone output** - Optimized Next.js build
- **Alpine Linux** - Minimal base image
- **Non-root user** - Security best practice

#### Database Connection Optimization
```typescript
// Connection pooling configuration
const config = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20,          // Maximum pool size
  min: 4,           // Minimum pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};
```

## Rollback Procedures

### 1. Quick Rollback

#### Rollback to Previous Version
```bash
# List recent deployments
gcloud run revisions list --service=mythoria-admin --region=europe-west9

# Rollback to specific revision
gcloud run services update-traffic mythoria-admin \
  --region=europe-west9 \
  --to-revisions=mythoria-admin-00001-xyz=100
```

### 2. Emergency Procedures

#### Emergency Rollback Script
```bash
#!/bin/bash
# emergency-rollback.sh

SERVICE_NAME="mythoria-admin"
REGION="europe-west9"

# Get the previous revision
PREVIOUS_REVISION=$(gcloud run revisions list \
  --service=$SERVICE_NAME \
  --region=$REGION \
  --format="value(metadata.name)" \
  --limit=2 | tail -1)

echo "Rolling back to: $PREVIOUS_REVISION"

# Rollback
gcloud run services update-traffic $SERVICE_NAME \
  --region=$REGION \
  --to-revisions=$PREVIOUS_REVISION=100

echo "Rollback completed"
```

## Troubleshooting

### Common Deployment Issues

#### 1. Build Failures
```bash
# Check build logs
gcloud builds log <BUILD_ID>

# Common issues:
# - Missing environment variables
# - Docker build context issues
# - Dependencies not found
# - TypeScript compilation errors
```

#### 2. Runtime Errors
```bash
# Check service logs
gcloud run logs read mythoria-admin --region=europe-west9

# Common issues:
# - Database connection failures
# - Missing secrets
# - Authentication configuration errors
# - Network connectivity issues
```

#### 3. Database Connection Issues
```bash
# Test VPC connectivity
gcloud compute ssh <instance-name> --zone=<zone>
telnet <db-private-ip> 5432

# Check VPC connector status
gcloud compute networks vpc-access connectors list
```

### Debugging Tools

#### Local Development Testing
```bash
# Build and test locally
docker build -t mythoria-admin-local .
docker run -p 3001:3000 \
  -e AUTH_SECRET="test-secret" \
  -e NEXTAUTH_URL="http://localhost:3001" \
  mythoria-admin-local
```

#### Production Debugging
```bash
# Enable debug logging
gcloud run services update mythoria-admin \
  --region=europe-west9 \
  --set-env-vars=DEBUG=true,LOG_LEVEL=debug
```

---

**Deployment Guide Version**: 1.0.0  
**Last Updated**: June 29, 2025  
**Service**: Mythoria Admin Portal v0.1.0+
