# 🚀 Production Simple Radio Server

## 🎯 Production Features

### 🔥 Performance Optimizations
- **Multi-core clustering** support for high concurrency
- **Optimized FFmpeg** settings for low latency
- **Efficient memory management** with rolling buffers
- **Rate limiting** to prevent abuse
- **Client capacity management** (150+ users)

### 🛡️ Security & Reliability
- **Security headers** (XSS, CSRF protection)
- **Rate limiting** per IP address
- **Graceful shutdown** handling
- **Dead client cleanup** automatic
- **Error handling** and logging

### 📊 Monitoring & Analytics
- **Real-time stats** endpoint
- **Health checks** for load balancers
- **Memory and performance** monitoring
- **Client connection** tracking

## 🚀 Quick Start

### Development Mode
```bash
npm run production
```

### Production Mode (Clustered)
```bash
npm run production-cluster
```

## 📡 OBS Setup (Same as Before)

```
Service: Custom
Server: rtmp://localhost:1935/live
Stream Key: stream
```

## 📊 Monitoring Endpoints

### Real-time Statistics
```
GET /stats
```
Response:
```json
{
  "server": "Production RTMP Radio",
  "clients": {
    "active": 45,
    "max": 200,
    "utilization": "23%"
  },
  "stream": {
    "active": true,
    "bufferSize": 52480,
    "rtmpUrl": "rtmp://localhost:1935/live/stream"
  },
  "system": {
    "workers": 8,
    "memory": {...},
    "uptime": 3600
  }
}
```

### Health Check
```
GET /health
```

## 🔧 Configuration

### Environment Variables
```bash
export MAX_CLIENTS=200              # Maximum simultaneous users
export ENABLE_CLUSTERING=true       # Enable multi-core processing
export RTMP_SECRET=your-secret-key   # RTMP authentication secret
export PORT=3000                     # HTTP server port
```

### Production Deployment
```bash
# Install PM2 for production process management
npm install -g pm2

# Start with PM2
pm2 start production-server.js --name "simple-radio" --instances max

# Monitor
pm2 monit

# Auto-restart on reboot
pm2 startup
pm2 save
```

## 📈 Load Testing

Test with 150 concurrent users:
```bash
# Install artillery for load testing
npm install -g artillery

# Create test config
cat > load-test.yml << EOF
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 60
      arrivalRate: 5
      name: "Ramp up"
    - duration: 300
      arrivalRate: 2
      name: "Sustained load"
scenarios:
  - name: "Stream connection"
    flow:
      - get:
          url: "/stream"
          timeout: 30
EOF

# Run load test
artillery run load-test.yml
```

## 🌐 Production Deployment Options

### 1. Cloud VPS (DigitalOcean, Linode, etc.)
```bash
# 2GB RAM, 2 CPU cores minimum
# Ubuntu 20.04 LTS
sudo apt update
sudo apt install nodejs npm ffmpeg
git clone your-repo
cd simple-radio
npm install
npm run production-cluster
```

### 2. Docker Deployment
```dockerfile
FROM node:18-alpine
RUN apk add --no-cache ffmpeg
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000 1935
CMD ["npm", "run", "production-cluster"]
```

### 3. Nginx Reverse Proxy
```nginx
upstream radio_backend {
    least_conn;
    server 127.0.0.1:3000;
    server 127.0.0.1:3001;
    server 127.0.0.1:3002;
    server 127.0.0.1:3003;
}

server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://radio_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # For streaming
        proxy_buffering off;
        proxy_cache off;
    }
    
    location /stream {
        proxy_pass http://radio_backend;
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 24h;
        proxy_send_timeout 24h;
    }
}
```

## 🔍 Performance Benchmarks

### Expected Performance
- **150+ concurrent users** with 2GB RAM
- **< 500ms latency** from OBS to browser
- **< 5% CPU usage** per 50 clients
- **~50MB RAM** per 100 clients

### Scaling Guidelines
| Users | RAM  | CPU Cores | Bandwidth |
|-------|------|-----------|-----------|
| 50    | 1GB  | 1         | 50 Mbps   |
| 100   | 2GB  | 2         | 100 Mbps  |
| 150   | 3GB  | 4         | 150 Mbps  |
| 200   | 4GB  | 4         | 200 Mbps  |

## 🚨 Troubleshooting

### High CPU Usage
- Enable clustering: `ENABLE_CLUSTERING=true`
- Reduce FFmpeg quality: Change `-preset ultrafast`
- Add more server instances

### Memory Leaks
- Monitor with: `curl localhost:3000/stats`
- Check dead client cleanup
- Restart with PM2: `pm2 restart simple-radio`

### Connection Drops
- Check network stability
- Increase buffer sizes
- Monitor with `/health` endpoint

## 📞 Support

Monitor real-time performance:
```bash
watch -n 1 'curl -s localhost:3000/stats | jq .'
```
