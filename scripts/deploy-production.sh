#!/bin/bash

# Mythoria Admin Portal - Production Deployment Script
# This script deploys the admin portal to Google Cloud Run

set -e

echo "🚀 Starting Mythoria Admin Portal deployment to production..."

# Check if gcloud is configured
if ! command -v gcloud &> /dev/null; then
    echo "❌ gcloud CLI is not installed. Please install it first."
    exit 1
fi

# Check if project is set correctly
PROJECT_ID=$(gcloud config get-value project)
if [ "$PROJECT_ID" != "oceanic-beach-460916-n5" ]; then
    echo "❌ Wrong project configured. Expected: oceanic-beach-460916-n5, Got: $PROJECT_ID"
    echo "Run: gcloud config set project oceanic-beach-460916-n5"
    exit 1
fi

echo "✅ Project: $PROJECT_ID"
echo "✅ Region: europe-west9"
echo "✅ Service: mythoria-admin"

# Submit build to Cloud Build
echo "📦 Building and deploying..."
gcloud builds submit --config cloudbuild.yaml

echo "🎉 Deployment completed successfully!"
echo "📝 Check your Cloud Run service at:"
echo "   https://console.cloud.google.com/run?project=$PROJECT_ID"

# Get service URL
SERVICE_URL=$(gcloud run services describe mythoria-admin --region=europe-west9 --format="value(status.url)" 2>/dev/null || echo "")
if [ ! -z "$SERVICE_URL" ]; then
    echo "🌐 Service URL: $SERVICE_URL"
else
    echo "⚠️  Unable to retrieve service URL. Check the Cloud Console."
fi
