# Railway.app RTMP Workaround Guide

## Option 1: Railway TCP Proxy (Recommended)

Railway.app supports custom ports through TCP proxy, but you need to configure it properly.

### Step 1: Update your railway.json
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  },
  "variables": {
    "NODE_ENV": "production",
    "RTMP_PORT": "1935"
  }
}
```

### Step 2: Configure TCP Service in Railway Dashboard
1. Go to your Railway project dashboard
2. Click on your service
3. Go to "Settings" tab
4. Look for "Networking" or "TCP Proxy" section
5. Add a new TCP proxy:
   - **Internal Port**: 1935
   - **External Port**: 1935 (or Railway will assign one)
   - **Protocol**: TCP

### Step 3: Get your TCP endpoint
Railway will give you something like:
- **TCP Endpoint**: `tcp://vatraxos-radio-production-tcpproxy.railway.app:1935`
- **Your RTMP URL**: `rtmp://vatraxos-radio-production-tcpproxy.railway.app:1935/live/stream`

## Option 2: Use a Different RTMP Port

If Railway blocks 1935, try using port 1936 or 8080:

### In your production-server.js:
```javascript
const RTMP_PORT = process.env.RTMP_PORT || 8080; // Use port 8080 instead
```

### In OBS:
- Server: `rtmp://vatraxos-radio-production.up.railway.app:8080/live`
- Stream Key: `stream`

## Option 3: RTMP over WebSocket Tunnel

Use a WebSocket tunnel to proxy RTMP traffic:

### Install ws-tunnel package:
```bash
npm install ws-tunnel
```

### Add to your server:
```javascript
const WebSocket = require('ws');

// Create WebSocket server for RTMP tunneling
const wss = new WebSocket.Server({ port: 8080 });
wss.on('connection', (ws) => {
  console.log('RTMP WebSocket tunnel connected');
  // Proxy RTMP data through WebSocket
});
```

## Option 4: Use Railway + External RTMP Service

Keep your web interface on Railway, but use an external RTMP service:

### Free RTMP Services:
- **Restream.io** (free tier)
- **Streamlabs** (free)
- **YouTube Live** (free)

### Setup:
1. Stream to external RTMP service
2. Use their stream URL in your Railway app
3. Fetch stream data via their API

## Testing Your RTMP Connection

### Test if port is accessible:
```bash
telnet vatraxos-radio-production.up.railway.app 1935
```

### Test with FFmpeg:
```bash
ffmpeg -re -f lavfi -i sine=frequency=1000:duration=10 \
  -c:a aac -f flv rtmp://vatraxos-radio-production.up.railway.app:1935/live/stream
```

## Check Railway Logs

```bash
railway logs --follow
```

Look for RTMP server startup messages like:
```
📡 RTMP Server: rtmp://vatraxos-radio-production.up.railway.app:1935/live/stream
🔗 RTMP PreConnect: [connection_id]
```

## If All Else Fails: Hybrid Approach

1. **Keep Railway for web interface** (HTTP/WebSocket)
2. **Use ngrok for local RTMP** (development)
3. **Migrate to Fly.io for production** (proper RTMP support)

### ngrok setup for development:
```bash
# Install ngrok
brew install ngrok

# Expose local RTMP port
ngrok tcp 1935

# Use the ngrok URL in OBS
# Example: rtmp://0.tcp.ngrok.io:12345/live
```
