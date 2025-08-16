# Railway.app Deployment Guide

## Why Railway.app instead of Render.com?

**Render.com limitations for RTMP:**
- Only exposes HTTP port (no RTMP port 1935)
- Limited networking capabilities
- No support for multiple port exposure

**Railway.app advantages:**
- ✅ Supports multiple ports (HTTP + RTMP)
- ✅ Better networking capabilities  
- ✅ More flexible infrastructure
- ✅ Built-in environment variables
- ✅ Auto-deployment from GitHub

## Deployment Steps

### 1. Push to GitHub (if not done already)
```bash
git add .
git commit -m "Configure for Railway.app deployment"
git push origin main
```

### 2. Deploy to Railway.app

1. **Go to [Railway.app](https://railway.app)**
2. **Sign up/Login** with your GitHub account
3. **Click "New Project"**
4. **Select "Deploy from GitHub repo"**
5. **Choose your `vatraxos` repository**
6. **Railway will auto-detect it's a Node.js project**

### 3. Configure Environment Variables

In your Railway.app dashboard, go to **Variables** tab and add:

| Variable | Value | Description |
|----------|-------|-------------|
| `NODE_ENV` | `production` | Production environment |
| `MAX_CLIENTS` | `150` | Maximum concurrent clients |
| `ENABLE_CLUSTERING` | `false` | Start with single process |
| `RTMP_SECRET` | `your-secret-key` | RTMP authentication (generate random) |
| `FFMPEG_PATH` | `/usr/bin/ffmpeg` | FFmpeg binary path |
| `RTMP_PORT` | `1935` | RTMP port (Railway will map this) |

### 4. Custom Port Configuration

Railway automatically exposes the main HTTP port, but for RTMP we need to configure it:

1. **In Railway dashboard, go to Settings**
2. **Add custom port mapping for RTMP:**
   - Internal Port: `1935`
   - Protocol: `TCP`
   - Public: `true`

### 5. Get Your URLs

After deployment, Railway will provide:
- **Web Interface**: `https://your-app-name.up.railway.app`
- **RTMP URL**: `rtmp://your-app-name.up.railway.app:1935/live/stream`

## OBS Configuration for Railway.app

### Settings → Stream:
- **Service**: Custom
- **Server**: `rtmp://your-app-name.up.railway.app:1935/live`
- **Stream Key**: `stream`

### Audio Settings (recommended):
- **Sample Rate**: 44.1 kHz
- **Channels**: Stereo
- **Audio Bitrate**: 128 kbps

## Testing Your Deployment

1. **Check health**: `https://your-app-name.up.railway.app/health`
2. **Check stream status**: `https://your-app-name.up.railway.app/stream-health`
3. **View stats**: `https://your-app-name.up.railway.app/stats`

## Monitoring and Logs

1. **Railway Dashboard**: View real-time logs
2. **Health endpoints**: Monitor stream status
3. **Console logs**: See RTMP connections and client count

## Troubleshooting

### RTMP Connection Issues:
```bash
# Test RTMP connectivity
ffmpeg -re -f lavfi -i sine=frequency=1000:duration=10 \
  -c:a aac -f flv rtmp://your-app-name.up.railway.app:1935/live/stream
```

### Check if RTMP port is accessible:
```bash
telnet your-app-name.up.railway.app 1935
```

## Scaling Options

Railway.app offers several plans:
- **Hobby**: $5/month - Good for testing
- **Pro**: $20/month - Production ready
- **Team**: $100/month - High traffic

## Migration from Render.com

If you have an existing Render.com deployment:
1. Delete the Render.com service
2. Follow the Railway.app steps above
3. Update any bookmarks/links to the new Railway URL

## Cost Comparison

| Platform | HTTP Only | RTMP Support | Monthly Cost |
|----------|-----------|--------------|--------------|
| Render.com | ✅ | ❌ | $7/month |
| Railway.app | ✅ | ✅ | $5/month |

Railway.app is both cheaper and more capable for this use case!
