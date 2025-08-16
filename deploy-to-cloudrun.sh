#!/bin/bash

# Google Cloud Run Deployment Script for WebRTC Radio
# Usage: ./deploy-to-cloudrun.sh [PROJECT_ID] [SERVICE_NAME] [REGION] [INPUT_RTMP_URL]

set -e

# Configuration
PROJECT_ID=${1:-"your-project-id"}
SERVICE_NAME=${2:-"webrtc-radio"}
REGION=${3:-"us-central1"}
INPUT_RTMP_URL=${4:-"rtmp://your-vm-ip:1935/live/stream"}

echo "🚀 Deploying WebRTC Radio to Google Cloud Run"
echo "=============================================="
echo "Project ID: $PROJECT_ID"
echo "Service Name: $SERVICE_NAME"
echo "Region: $REGION"
echo "External RTMP URL: $INPUT_RTMP_URL"
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ gcloud CLI is not installed. Please install it first:"
    echo "   https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Set the project
echo "🔧 Setting project to $PROJECT_ID..."
gcloud config set project "$PROJECT_ID"

# Enable required APIs
echo "🔌 Enabling required APIs..."
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com

# Build and submit container image
echo "🏗️  Building container image..."
IMAGE_URL="gcr.io/$PROJECT_ID/$SERVICE_NAME:latest"
gcloud builds submit --tag "$IMAGE_URL" .

# Deploy to Cloud Run
echo "🚀 Deploying to Cloud Run..."
gcloud run deploy "$SERVICE_NAME" \
  --image "$IMAGE_URL" \
  --platform managed \
  --region "$REGION" \
  --allow-unauthenticated \
  --port 8080 \
  --memory 1Gi \
  --cpu 1 \
  --max-instances 10 \
  --concurrency 200 \
  --timeout 300 \
  --set-env-vars "CLOUD_RUN=true,DISABLE_RTMP=true,INPUT_RTMP_URL=$INPUT_RTMP_URL,NODE_ENV=production,MAX_CLIENTS=200"

# Get the service URL
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" --platform managed --region "$REGION" --format 'value(status.url)')

echo ""
echo "✅ Deployment completed successfully!"
echo "🌐 Service URL: $SERVICE_URL"
echo ""
echo "📋 Next Steps:"
echo "1. Set up your VM with RTMP server on port 1935"
echo "2. Stream to your VM: rtmp://your-vm-ip:1935/live/stream"
echo "3. Access the web player: $SERVICE_URL"
echo ""
echo "🔧 To update the external RTMP URL later:"
echo "gcloud run services update $SERVICE_NAME --region $REGION --set-env-vars INPUT_RTMP_URL=rtmp://new-vm-ip:1935/live/stream"
echo ""
echo "📊 Monitor your service:"
echo "Stats: $SERVICE_URL/stats"
echo "Health: $SERVICE_URL/health"
