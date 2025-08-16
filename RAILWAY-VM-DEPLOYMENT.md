# 🚀 Railway + VM Deployment Guide

This guide will help you deploy your WebRTC Radio with Railway.app handling the web interface and a Google Cloud VM handling RTMP ingest.

## 🏗️ Architecture Overview

```
OBS/Streaming Software → VM (RTMP Server) → Railway.app (Web Interface) → Users
```

- **VM**: Handles RTMP ingest on port 1935 (Railway can't handle this port)
- **Railway**: Hosts the web interface and consumes RTMP from VM
- **Users**: Access the web player through Railway's public domain

## 📋 Step-by-Step Deployment

### Step 1: Set Up Your VM (RTMP Server)

First, you need to get your VM's external IP. If you don't have it yet:

```bash
# If you haven't created the VM yet
./setup-vm.sh YOUR_PROJECT_ID us-central1-a rtmp-server

# If VM exists, get the IP
gcloud compute instances describe rtmp-server --zone=us-central1-a --format='get(networkInterfaces[0].accessConfigs[0].natIP)'
```

### Step 2: Upload Code to VM

```bash
# Upload your application code to the VM
./upload-to-vm.sh rtmp-server us-central1-a YOUR_PROJECT_ID
```

This script will:
- Upload your production-server.js, package.json, and index.html to the VM
- Install Node.js dependencies
- Configure the RTMP server to run on port 1935
- Start the service automatically

### Step 3: Test VM RTMP Server

After upload, test your VM:

```bash
# SSH into your VM
gcloud compute ssh rtmp-server --zone=us-central1-a

# Check service status
sudo systemctl status rtmp-server

# View logs
sudo journalctl -u rtmp-server -f
```

Your VM should now be:
- ✅ Running RTMP server on port 1935
- ✅ Accepting OBS streams at `rtmp://VM_IP:1935/live/stream`
- ✅ Serving web interface at `http://VM_IP:3000`

### Step 4: Deploy to Railway

1. **Connect your GitHub repo to Railway:**
   - Go to [railway.app](https://railway.app)
   - Create new project from GitHub
   - Select this repository

2. **Set Environment Variables in Railway:**
   ```bash
   NODE_ENV=production
   RAILWAY_MODE=true
   DISABLE_RTMP=true
   MAX_CLIENTS=200
   INPUT_RTMP_URL=rtmp://YOUR_VM_IP:1935/live/stream
   ```

   Replace `YOUR_VM_IP` with your actual VM external IP.

3. **Deploy:**
   - Railway will automatically detect your `package.json`
   - It will run `npm start` (which runs `production-server.js`)
   - Your app will be available at your Railway domain

### Step 5: Test End-to-End

1. **Start streaming to VM:**
   - Open OBS Studio
   - Set Server: `rtmp://YOUR_VM_IP:1935/live`
   - Set Stream Key: `stream`
   - Start Streaming

2. **Access web player:**
   - Go to your Railway app URL
   - Click Play to start listening
   - You should hear your stream!

## 🔧 Local Testing

Test Railway mode locally before deploying:

```bash
# Test with your actual VM IP
npm run railway-local

# Or manually with your VM IP
RAILWAY_MODE=true DISABLE_RTMP=true INPUT_RTMP_URL=rtmp://YOUR_VM_IP:1935/live/stream npm start
```

## 📊 Monitoring

### Railway App Monitoring
- **Stats**: `https://your-railway-app.railway.app/stats`
- **Health**: `https://your-railway-app.railway.app/health`
- **Stream Health**: `https://your-railway-app.railway.app/stream-health`

### VM Monitoring
```bash
# SSH into VM
gcloud compute ssh rtmp-server --zone=us-central1-a

# Check service status
sudo systemctl status rtmp-server

# View logs
sudo journalctl -u rtmp-server -f

# Check if RTMP port is open
sudo netstat -tlnp | grep :1935
```

## 🔄 Updates and Maintenance

### Update VM Code
```bash
# Re-upload code to VM
./upload-to-vm.sh rtmp-server us-central1-a

# Or manually update specific files
gcloud compute scp production-server.js rtmp-server:/opt/rtmp-server/ --zone=us-central1-a
gcloud compute ssh rtmp-server --zone=us-central1-a --command="cd /opt/rtmp-server && sudo systemctl restart rtmp-server"
```

### Update Railway App
- Push changes to your GitHub repository
- Railway will automatically redeploy

### Change VM IP
If you change VMs or the IP changes:

1. Update Railway environment variable:
   ```
   INPUT_RTMP_URL=rtmp://NEW_VM_IP:1935/live/stream
   ```

2. Redeploy Railway app

## 🐛 Troubleshooting

### Common Issues

1. **Railway can't connect to VM:**
   - Check VM firewall allows port 1935: `gcloud compute firewall-rules list`
   - Verify VM external IP is correct
   - Test RTMP connectivity: `telnet VM_IP 1935`

2. **No audio in Railway web player:**
   - Check Railway logs for FFmpeg errors
   - Verify RTMP stream is active on VM
   - Check `/stream-health` endpoint

3. **OBS can't connect to VM:**
   - Verify VM is running: `gcloud compute instances list`
   - Check RTMP service status on VM
   - Ensure firewall rule allows port 1935

### Useful Commands

```bash
# Check Railway logs (if using Railway CLI)
railway logs

# Check VM RTMP service
gcloud compute ssh rtmp-server --zone=us-central1-a --command="sudo journalctl -u rtmp-server --since '10 minutes ago'"

# Test RTMP port from local machine
telnet YOUR_VM_IP 1935

# Check Railway app status
curl https://your-railway-app.railway.app/health
```

## 💰 Cost Optimization

### VM (Google Cloud)
- Use `e2-micro` for light usage (free tier eligible)
- Use `e2-standard-2` for better performance
- Stop VM when not streaming to save costs

### Railway
- Free tier: 512MB RAM, $5 usage credit
- Pro tier: More resources and no sleep mode

### Stop/Start VM
```bash
# Stop VM to save costs
gcloud compute instances stop rtmp-server --zone=us-central1-a

# Start VM when needed
gcloud compute instances start rtmp-server --zone=us-central1-a

# Get new IP after restart (if not using static IP)
gcloud compute instances describe rtmp-server --zone=us-central1-a --format='get(networkInterfaces[0].accessConfigs[0].natIP)'
```

## 🎯 Quick Reference

### Environment Variables for Railway
```
NODE_ENV=production
RAILWAY_MODE=true
DISABLE_RTMP=true
MAX_CLIENTS=200
INPUT_RTMP_URL=rtmp://YOUR_VM_IP:1935/live/stream
```

### OBS Settings
```
Service: Custom
Server: rtmp://YOUR_VM_IP:1935/live
Stream Key: stream
```

### Important URLs
- **Railway Web Player**: `https://your-app.railway.app`
- **VM RTMP Endpoint**: `rtmp://VM_IP:1935/live/stream`
- **VM Web Interface**: `http://VM_IP:3000` (backup/testing)

That's it! Your WebRTC Radio should now be running with Railway handling the web interface and your VM handling RTMP ingest. 🎉
