# Google Cloud Run Deployment Guide

This guide explains how to deploy your WebRTC Radio server to Google Cloud Run, which only supports HTTP(S) on ports 80/443 and doesn't allow RTMP ingest on port 1935.

## Architecture

- **VM Instance**: Runs RTMP server for OBS/streaming software
- **Cloud Run**: Runs the web application that consumes RTMP from VM
- **Users**: Connect to Cloud Run web interface

## Environment Variables

The server supports these environment flags for Cloud Run:

- `CLOUD_RUN=true`: Enables Cloud Run mode
- `DISABLE_RTMP=true`: Disables NodeMediaServer (no local RTMP server)
- `INPUT_RTMP_URL`: External RTMP URL to consume from (e.g., `rtmp://vm-ip:1935/live/stream`)
- `PORT=8080`: Cloud Run uses this port

## Quick Deployment

1. **Set up your VM with RTMP server** (separate from Cloud Run):
   ```bash
   # On your VM, run the regular server with RTMP enabled
   node production-server.js
   ```

2. **Deploy to Cloud Run**:
   ```bash
   ./deploy-to-cloudrun.sh YOUR_PROJECT_ID webrtc-radio us-central1 rtmp://YOUR_VM_IP:1935/live/stream
   ```

3. **Stream to your VM**:
   - OBS → `rtmp://YOUR_VM_IP:1935/live/stream`
   - Cloud Run consumes from VM → Users access Cloud Run web interface

## Manual Deployment Steps

### 1. Build and Push Container

```bash
# Set your project
gcloud config set project YOUR_PROJECT_ID

# Build the image
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/webrtc-radio .

# Deploy to Cloud Run
gcloud run deploy webrtc-radio \
  --image gcr.io/YOUR_PROJECT_ID/webrtc-radio \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080 \
  --memory 1Gi \
  --cpu 1 \
  --max-instances 10 \
  --set-env-vars "CLOUD_RUN=true,DISABLE_RTMP=true,INPUT_RTMP_URL=rtmp://YOUR_VM_IP:1935/live/stream"
```

### 2. Update RTMP URL Later

```bash
gcloud run services update webrtc-radio \
  --region us-central1 \
  --set-env-vars INPUT_RTMP_URL=rtmp://new-vm-ip:1935/live/stream
```

## Local Testing

Test Cloud Run mode locally:

```bash
# Test with external RTMP source
npm run cloud-run-local

# Or with environment variables
CLOUD_RUN=true DISABLE_RTMP=true INPUT_RTMP_URL=rtmp://localhost:1935/live/stream npm start
```

## Environment Modes

### Local Development (Full RTMP)
```bash
npm start
# - Runs NodeMediaServer on port 1935
# - FFmpeg consumes from localhost:1935
# - OBS streams directly to this server
```

### Cloud Run Mode (External RTMP)
```bash
npm run cloud-run
# - No local RTMP server
# - FFmpeg consumes from INPUT_RTMP_URL
# - OBS streams to separate VM
```

## Monitoring

Once deployed, monitor your service:

- **Stats**: `https://your-service-url/stats`
- **Health**: `https://your-service-url/health`
- **Stream Health**: `https://your-service-url/stream-health`

## Troubleshooting

### Common Issues

1. **RTMP Connection Failed**:
   - Check if VM is accessible from Cloud Run
   - Verify INPUT_RTMP_URL is correct
   - Ensure VM firewall allows port 1935

2. **FFmpeg Errors**:
   - Check logs: `gcloud run logs tail webrtc-radio`
   - Verify RTMP stream is active on VM

3. **No Audio in Browser**:
   - Check if FFmpeg is processing: `/stream-health`
   - Verify external RTMP source is streaming

### Logs

```bash
# View Cloud Run logs
gcloud run logs tail webrtc-radio --region us-central1

# Follow logs in real-time
gcloud run logs tail webrtc-radio --region us-central1 --follow
```

## Cost Optimization

- **Min Instances**: Set to 0 for cost savings
- **Max Instances**: Adjust based on expected traffic
- **CPU/Memory**: Start with 1 CPU, 1Gi RAM
- **Request Timeout**: Set to 300s for long streaming sessions
