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

### Deployment on Render.com

1. Fork/clone this repository
2. Connect your GitHub repository to Render.com
3. Create a new Web Service with these settings:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Starter (or higher for more clients)

### Environment Variables for Render.com

Set these in your Render.com dashboard:

| Variable | Value | Description |
|----------|-------|-------------|
| `NODE_ENV` | `production` | Production environment |
| `MAX_CLIENTS` | `100` | Maximum concurrent clients |
| `ENABLE_CLUSTERING` | `false` | Disable for Starter plan |
| `RTMP_SECRET` | `your-secret-key` | RTMP authentication secret |
| `FFMPEG_PATH` | `/usr/bin/ffmpeg` | FFmpeg binary path |

### Port Configuration

- **HTTP Server**: Uses `process.env.PORT` (automatically set by Render.com)
- **RTMP Server**: Port 1935 (internal)
- **Media Server**: Port 8000 (internal)

### OBS Setup

1. Open OBS Studio
2. Go to Settings → Stream
3. Service: Custom
4. Server: `rtmp://your-app.onrender.com:1935/live`
5. Stream Key: `stream`
6. Click "Start Streaming"

### Monitoring

- Health Check: `https://your-app.onrender.com/health`
- Stream Status: `https://your-app.onrender.com/stream-health`
- Statistics: `https://your-app.onrender.com/stats`

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
