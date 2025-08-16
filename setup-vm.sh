#!/bin/bash

# VM Setup Script for RTMP Server
# This script sets up a Google Cloud VM instance to handle RTMP ingest
# Usage: ./setup-vm.sh [PROJECT_ID] [ZONE] [INSTANCE_NAME]

set -e

# Configuration
PROJECT_ID=${1:-"your-project-id"}
ZONE=${2:-"us-central1-a"}
INSTANCE_NAME=${3:-"rtmp-server"}
MACHINE_TYPE="e2-standard-2"  # 2 vCPUs, 8GB RAM
BOOT_DISK_SIZE="20GB"

echo "🖥️  Setting up RTMP VM Instance"
echo "==============================="
echo "Project ID: $PROJECT_ID"
echo "Zone: $ZONE"
echo "Instance Name: $INSTANCE_NAME"
echo "Machine Type: $MACHINE_TYPE"
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
gcloud services enable compute.googleapis.com

# Create startup script
echo "📝 Creating startup script..."
cat > startup-script.sh << 'EOF'
#!/bin/bash

# Update system
apt-get update
apt-get install -y curl software-properties-common

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Install FFmpeg
apt-get install -y ffmpeg

# Create app directory
mkdir -p /opt/rtmp-server
cd /opt/rtmp-server

# Download the application files
# Note: Replace this with your actual repository or upload method
echo "Downloading application files..."

# For now, create a basic package.json
cat > package.json << 'PACKAGE_EOF'
{
  "name": "rtmp-vm-server",
  "version": "1.0.0",
  "dependencies": {
    "express": "^4.18.2",
    "node-media-server": "^2.6.0",
    "socket.io": "^4.8.1"
  }
}
PACKAGE_EOF

# Install dependencies
npm install

# Create systemd service
cat > /etc/systemd/system/rtmp-server.service << 'SERVICE_EOF'
[Unit]
Description=RTMP Streaming Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/rtmp-server
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=RTMP_PORT=1935
ExecStart=/usr/bin/node production-server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
SERVICE_EOF

# Enable and start the service (will be done after we upload the code)
systemctl daemon-reload
systemctl enable rtmp-server

echo "VM setup completed!"
EOF

# Create the VM instance
echo "🚀 Creating VM instance..."
gcloud compute instances create "$INSTANCE_NAME" \
    --zone="$ZONE" \
    --machine-type="$MACHINE_TYPE" \
    --boot-disk-size="$BOOT_DISK_SIZE" \
    --boot-disk-type="pd-standard" \
    --image-family="debian-11" \
    --image-project="debian-cloud" \
    --metadata-from-file startup-script=startup-script.sh \
    --tags="rtmp-server,http-server" \
    --scopes="https://www.googleapis.com/auth/cloud-platform"

# Create firewall rules
echo "🔥 Creating firewall rules..."
gcloud compute firewall-rules create allow-rtmp \
    --allow tcp:1935 \
    --source-ranges 0.0.0.0/0 \
    --target-tags rtmp-server \
    --description "Allow RTMP traffic on port 1935" || echo "Firewall rule might already exist"

gcloud compute firewall-rules create allow-http-alt \
    --allow tcp:3000 \
    --source-ranges 0.0.0.0/0 \
    --target-tags rtmp-server \
    --description "Allow HTTP traffic on port 3000" || echo "Firewall rule might already exist"

# Get the external IP
echo "⏳ Waiting for instance to be ready..."
sleep 30

EXTERNAL_IP=$(gcloud compute instances describe "$INSTANCE_NAME" --zone="$ZONE" --format='get(networkInterfaces[0].accessConfigs[0].natIP)')

echo ""
echo "✅ VM Instance created successfully!"
echo "🌐 External IP: $EXTERNAL_IP"
echo "📡 RTMP URL: rtmp://$EXTERNAL_IP:1935/live/stream"
echo "🖥️  SSH Access: gcloud compute ssh $INSTANCE_NAME --zone=$ZONE"
echo ""
echo "📋 Next Steps:"
echo "1. Upload your application code to the VM:"
echo "   gcloud compute scp --recurse . $INSTANCE_NAME:/opt/rtmp-server --zone=$ZONE"
echo "2. SSH into the VM and start the service:"
echo "   gcloud compute ssh $INSTANCE_NAME --zone=$ZONE"
echo "   sudo systemctl start rtmp-server"
echo "3. Use this RTMP URL for Cloud Run deployment:"
echo "   rtmp://$EXTERNAL_IP:1935/live/stream"

# Clean up temporary files
rm -f startup-script.sh

echo ""
echo "💡 Don't forget to update your Cloud Run deployment with:"
echo "   INPUT_RTMP_URL=rtmp://$EXTERNAL_IP:1935/live/stream"
