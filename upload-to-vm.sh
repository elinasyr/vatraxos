#!/bin/bash

# Upload and Deploy Script for VM RTMP Server
# Usage: ./upload-to-vm.sh [INSTANCE_NAME] [ZONE] [PROJECT_ID]

set -e

# Configuration
INSTANCE_NAME=${1:-"rtmp-server"}
ZONE=${2:-"us-central1-a"}
PROJECT_ID=${3:-$(gcloud config get-value project)}

echo "📤 Uploading code to VM RTMP Server"
echo "====================================="
echo "Instance: $INSTANCE_NAME"
echo "Zone: $ZONE"
echo "Project: $PROJECT_ID"
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ gcloud CLI is not installed. Please install it first:"
    echo "   https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Check if instance exists
echo "🔍 Checking if VM instance exists..."
if ! gcloud compute instances describe "$INSTANCE_NAME" --zone="$ZONE" --project="$PROJECT_ID" &>/dev/null; then
    echo "❌ VM instance '$INSTANCE_NAME' not found in zone '$ZONE'"
    echo "💡 Create it first with: ./setup-vm.sh $PROJECT_ID $ZONE $INSTANCE_NAME"
    exit 1
fi

# Get VM external IP
EXTERNAL_IP=$(gcloud compute instances describe "$INSTANCE_NAME" --zone="$ZONE" --project="$PROJECT_ID" --format='get(networkInterfaces[0].accessConfigs[0].natIP)')
echo "🌐 VM External IP: $EXTERNAL_IP"

# Create temporary directory with only necessary files
echo "📦 Preparing files for upload..."
TEMP_DIR=$(mktemp -d)
cp production-server.js "$TEMP_DIR/"
cp package.json "$TEMP_DIR/"
cp index.html "$TEMP_DIR/"

# Create a VM-specific configuration
cat > "$TEMP_DIR/.env" << EOF
NODE_ENV=production
PORT=3000
RTMP_PORT=1935
RAILWAY_MODE=false
DISABLE_RTMP=false
MAX_CLIENTS=100
FFMPEG_PATH=/usr/bin/ffmpeg
EOF

# Upload files to VM
echo "📤 Uploading files to VM..."
gcloud compute scp --recurse "$TEMP_DIR"/* "$INSTANCE_NAME":/opt/rtmp-server/ --zone="$ZONE" --project="$PROJECT_ID"

# Clean up temp directory
rm -rf "$TEMP_DIR"

# SSH into VM and set up the service
echo "🔧 Setting up service on VM..."
gcloud compute ssh "$INSTANCE_NAME" --zone="$ZONE" --project="$PROJECT_ID" --command="
    cd /opt/rtmp-server && \
    sudo npm install && \
    sudo systemctl daemon-reload && \
    sudo systemctl enable rtmp-server && \
    sudo systemctl restart rtmp-server && \
    sudo systemctl status rtmp-server --no-pager
"

echo ""
echo "✅ VM Setup Complete!"
echo "🌐 VM External IP: $EXTERNAL_IP"
echo "📡 RTMP URL for OBS: rtmp://$EXTERNAL_IP:1935/live/stream"
echo "🖥️  VM Web Interface: http://$EXTERNAL_IP:3000"
echo ""
echo "📋 Next Steps for Railway:"
echo "1. Set environment variable in Railway:"
echo "   INPUT_RTMP_URL=rtmp://$EXTERNAL_IP:1935/live/stream"
echo "2. Set RAILWAY_MODE=true"
echo "3. Set DISABLE_RTMP=true"
echo "4. Deploy to Railway"
echo ""
echo "🎬 OBS Setup:"
echo "   Server: rtmp://$EXTERNAL_IP:1935/live"
echo "   Stream Key: stream"
echo ""
echo "📊 Monitor VM:"
echo "   SSH: gcloud compute ssh $INSTANCE_NAME --zone=$ZONE"
echo "   Logs: sudo journalctl -u rtmp-server -f"
