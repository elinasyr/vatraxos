# Vatraxos Radio Server

A production-ready WebRTC radio streaming server with RTMP support.

## Features

- Real-time audio streaming via WebRTC
- RTMP server for OBS integration
- Low latency (<100ms)
- Production-ready with clustering support
- Automatic client management and rate limiting

## Quick Start

### Local Development

```bash
npm install
npm start
```

### Deployment on Railway.app (Recommended)

Railway.app supports both HTTP and RTMP ports, making it perfect for this application.

1. Fork/clone this repository
2. Connect your GitHub repository to Railway.app
3. Railway will auto-detect and deploy your Node.js app
4. Configure the environment variables listed below

**Why Railway.app over Render.com?**
- ✅ Supports RTMP port 1935 (Render.com only supports HTTP)
- ✅ Better networking capabilities
- ✅ More affordable ($5/month vs $7/month)
- ✅ Easier RTMP configuration

### Environment Variables for Railway.app

Set these in your Railway.app dashboard:

| Variable | Value | Description |
|----------|-------|-------------|
| `NODE_ENV` | `production` | Production environment |
| `MAX_CLIENTS` | `150` | Maximum concurrent clients |
| `ENABLE_CLUSTERING` | `false` | Disable for single instance |
| `RTMP_SECRET` | `your-secret-key` | RTMP authentication secret |
| `FFMPEG_PATH` | `/usr/bin/ffmpeg` | FFmpeg binary path |

### Port Configuration

- **HTTP Server**: Uses `process.env.PORT` (automatically set by Railway.app)
- **RTMP Server**: Port 1935 (Railway.app will expose this)
- **Media Server**: Port 8000 (internal)

### OBS Setup for Railway.app

1. Open OBS Studio
2. Go to Settings → Stream
3. Service: Custom
4. Server: `rtmp://your-app-name.up.railway.app:1935/live`
5. Stream Key: `stream`
6. Click "Start Streaming"

### Monitoring

- Health Check: `https://your-app-name.up.railway.app/health`
- Stream Status: `https://your-app-name.up.railway.app/stream-health`
- Statistics: `https://your-app-name.up.railway.app/stats`

## Architecture

The server consists of:
- Express.js HTTP server for the web interface
- Socket.io for WebRTC signaling
- Node Media Server for RTMP handling
- FFmpeg for audio processing

## Performance

- Optimized for 100+ concurrent clients
- WebRTC for low-latency streaming
- Automatic client cleanup and resource management
- Production-ready error handling

## License

MIT
