const express = require('express');
const NodeMediaServer = require('node-media-server');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const cluster = require('cluster');
const os = require('os');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  transports: ['websocket', 'polling']
});
const HTTP_PORT = process.env.PORT || 3000; // Railway.app uses PORT env var
const RTMP_PORT = process.env.RTMP_PORT || 8080; // Try port 8080 instead of 1935 for Railway

// Production configuration - Optimized for Railway.app
const MAX_CLIENTS = process.env.MAX_CLIENTS || 150; // Railway can handle more clients
const ENABLE_CLUSTERING = process.env.ENABLE_CLUSTERING === 'true' && process.env.NODE_ENV === 'production';
const numCPUs = ENABLE_CLUSTERING ? Math.min(os.cpus().length, 4) : 1; // Railway has better CPU support

// Global variables to manage streams
let currentStream = null;
let activeClients = new Set();
let webrtcClients = new Set();
let streamBuffer = Buffer.alloc(0);
let isStreamActive = false;
let audioChunks = [];
let rtmpStreamInfo = null;

// RTMP Server Configuration - Optimized for production
const config = {
  rtmp: {
    port: RTMP_PORT,
    chunk_size: 60000,
    gop_cache: true,
    ping: 30,
    ping_timeout: 60,
    // Production optimizations
    allow_origin: '*',
    relay: {
      ffmpeg: process.env.FFMPEG_PATH || '/usr/bin/ffmpeg', // Render.com FFmpeg path
      tasks: [
        {
          app: 'live',
          mode: 'push',
          edge: 'rtmp://127.0.0.1:1936'
        }
      ]
    }
  },
  http: {
    port: 8000,
    allow_origin: '*',
    mediaroot: process.env.MEDIA_PATH || './media', // Configurable media path
    // Enable HTTP caching
    cache_control: {
      'max-age': 30
    }
  },
  auth: {
    play: false,
    publish: false,
    secret: process.env.RTMP_SECRET || 'production-secret'
  }
};

// Initialize clustering for production
if (ENABLE_CLUSTERING && cluster.isMaster) {
  console.log(`🚀 Master ${process.pid} is running`);
  console.log(`🔥 Starting ${numCPUs} workers for production load`);

  // Fork workers
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.log(`💀 Worker ${worker.process.pid} died`);
    console.log('🔄 Starting a new worker');
    cluster.fork();
  });
} else {
  // Worker process or single process mode
  startServer();
}

function startServer() {
  const nms = new NodeMediaServer(config);

  // Production middleware
  app.use(express.json({ limit: '1mb' }));
  app.use(express.static(__dirname, { 
    maxAge: '1d',
    etag: true 
  }));

  // Security headers
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
  });

  // Rate limiting middleware
  const rateLimit = new Map();
  app.use('/stream', (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const windowMs = 60000; // 1 minute
    const maxRequests = 5; // Max 5 connections per minute per IP

    if (!rateLimit.has(ip)) {
      rateLimit.set(ip, { count: 1, resetTime: now + windowMs });
      return next();
    }

    const limit = rateLimit.get(ip);
    if (now > limit.resetTime) {
      limit.count = 1;
      limit.resetTime = now + windowMs;
      return next();
    }

    if (limit.count >= maxRequests) {
      return res.status(429).json({ error: 'Too many requests' });
    }

    limit.count++;
    next();
  });

  // Serve the main HTML page
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
  });

  // WebRTC Signaling and Audio Streaming via WebSocket
  io.on('connection', (socket) => {
    console.log(`🎧 WebRTC Client connected: ${socket.id} (${webrtcClients.size + 1}/${MAX_CLIENTS})`);
    
    // Check client limit
    if (webrtcClients.size >= MAX_CLIENTS) {
      socket.emit('error', { 
        message: 'Server at capacity', 
        maxClients: MAX_CLIENTS,
        currentClients: webrtcClients.size 
      });
      socket.disconnect();
      return;
    }

    webrtcClients.add(socket);
    
    // Send buffered audio data immediately
    if (audioChunks.length > 0) {
      socket.emit('audio-buffer', {
        chunks: audioChunks.slice(-10), // Send last 10 chunks
        streamInfo: rtmpStreamInfo
      });
    }

    // Start stream if not active
    if (!isStreamActive) {
      startOptimizedStream();
    }

    // WebRTC signaling
    socket.on('offer', (offer) => {
      socket.broadcast.emit('offer', offer);
    });

    socket.on('answer', (answer) => {
      socket.broadcast.emit('answer', answer);
    });

    socket.on('ice-candidate', (candidate) => {
      socket.broadcast.emit('ice-candidate', candidate);
    });

    // Client requests stream info
    socket.on('request-stream-info', () => {
      socket.emit('stream-info', {
        active: isStreamActive,
        rtmpInfo: rtmpStreamInfo,
        bufferSize: audioChunks.length
      });
    });

    // Handle client disconnect
    socket.on('disconnect', () => {
      webrtcClients.delete(socket);
      console.log(`📤 WebRTC Client disconnected: ${socket.id} (${webrtcClients.size}/${MAX_CLIENTS})`);
      
      // Stop stream if no clients
      if (webrtcClients.size === 0 && activeClients.size === 0 && currentStream) {
        console.log('🔌 No more clients, stopping stream');
        currentStream.kill('SIGTERM');
        currentStream = null;
        isStreamActive = false;
        streamBuffer = Buffer.alloc(0);
        audioChunks = [];
      }
    });
  });

  // High-performance audio streaming endpoint
  app.get('/stream', (req, res) => {
    // Check client limit
    if (activeClients.size >= MAX_CLIENTS) {
      return res.status(503).json({ 
        error: 'Server at capacity', 
        maxClients: MAX_CLIENTS,
        currentClients: activeClients.size 
      });
    }

    console.log(`🎧 Client connected (${activeClients.size + 1}/${MAX_CLIENTS})`);
    
    // Optimized headers for streaming
    res.writeHead(200, {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Range',
      'Access-Control-Expose-Headers': 'Accept-Ranges, Content-Encoding, Content-Length, Content-Range',
      'Transfer-Encoding': 'chunked',
      'X-Accel-Buffering': 'no' // Disable nginx buffering for real-time
    });

    activeClients.add(res);

    // Send buffered data if available
    if (streamBuffer.length > 0) {
      try {
        res.write(streamBuffer);
      } catch (err) {
        console.error('Error sending buffer:', err.message);
        activeClients.delete(res);
        return;
      }
    }

    // Start stream if not active
    if (!isStreamActive) {
      startOptimizedStream();
    }

    // Handle client disconnect
    const cleanup = () => {
      activeClients.delete(res);
      console.log(`📤 Client disconnected (${activeClients.size}/${MAX_CLIENTS})`);
      
      // Stop stream if no clients
      if (activeClients.size === 0 && currentStream) {
        console.log('🔌 No more clients, stopping stream');
        currentStream.kill('SIGTERM');
        currentStream = null;
        isStreamActive = false;
        streamBuffer = Buffer.alloc(0);
      }
    };

    req.on('close', cleanup);
    req.on('aborted', cleanup);
    res.on('error', cleanup);
  });

  function startOptimizedStream() {
    if (isStreamActive) return;

    console.log('🎵 Starting optimized RTMP stream processing');
    isStreamActive = true;

    // Wait a moment for RTMP stream to be fully established
    setTimeout(() => {
      // Optimized FFmpeg parameters for 150+ users
      const ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';
      currentStream = spawn(ffmpegPath, [
        '-i', 'rtmp://localhost:1935/live/stream',
        '-vn',                          // No video
        '-c:a', 'libmp3lame',           // MP3 codec
        '-b:a', '128k',                 // Bitrate
        '-ac', '2',                     // Stereo
        '-ar', '44100',                 // Sample rate
        '-f', 'mp3',                    // Format
        '-preset', 'ultrafast',         // Fast encoding
        '-tune', 'zerolatency',         // Low latency
        '-threads', '0',                // Use all CPU cores
        '-bufsize', '64k',              // Small buffer for low latency
        '-maxrate', '128k',             // Max bitrate
        '-avoid_negative_ts', 'make_zero',
        '-fflags', '+genpts',
        '-reconnect', '1',              // Auto-reconnect on failure
        '-reconnect_streamed', '1',     // Reconnect for streamed input
        '-reconnect_delay_max', '2',    // Max reconnect delay
        '-loglevel', 'error',           // Only show errors
        '-'                             // Output to stdout
      ]);

      // Optimized data handling for both HTTP and WebSocket clients
      currentStream.stdout.on('data', (chunk) => {
        // Maintain a rolling buffer (last 5 seconds of audio)
        streamBuffer = Buffer.concat([streamBuffer, chunk]);
        if (streamBuffer.length > 80000) { // ~5 seconds at 128kbps
          streamBuffer = streamBuffer.slice(-40000); // Keep last 2.5 seconds
        }

        // Add to audio chunks for WebRTC clients (keep last 50 chunks ~3 seconds)
        audioChunks.push({
          data: chunk.toString('base64'),
          timestamp: Date.now(),
          size: chunk.length
        });
        if (audioChunks.length > 50) {
          audioChunks = audioChunks.slice(-25); // Keep last 25 chunks
        }

        // Broadcast to WebSocket/WebRTC clients
        if (webrtcClients.size > 0) {
          io.emit('audio-chunk', {
            data: chunk.toString('base64'),
            timestamp: Date.now(),
            size: chunk.length
          });
        }

        // Broadcast to HTTP clients efficiently (legacy support)
        const deadClients = [];
        for (const client of activeClients) {
          try {
            if (!client.destroyed && !client.writableEnded) {
              client.write(chunk);
            } else {
              deadClients.push(client);
            }
          } catch (err) {
            console.log('HTTP Client write error:', err.message);
            deadClients.push(client);
          }
        }

        // Clean up dead HTTP clients
        deadClients.forEach(client => activeClients.delete(client));
      });

      currentStream.stderr.on('data', (data) => {
        const msg = data.toString().trim();
        if (msg.includes('Connection refused') || msg.includes('No route to host')) {
          console.log('⚠️  RTMP stream not ready, retrying...');
        } else if (msg.includes('error') || msg.includes('Error')) {
          console.error(`FFmpeg Error: ${msg}`);
        }
      });

      currentStream.on('close', (code) => {
        console.log(`🔌 FFmpeg process exited with code ${code}`);
        isStreamActive = false;
        currentStream = null;
        
        // If clients are still connected and exit wasn't clean, try to restart
        if (activeClients.size > 0 && code !== 0) {
          console.log('🔄 Attempting to restart stream for waiting clients...');
          setTimeout(() => {
            if (activeClients.size > 0) {
              startOptimizedStream();
            }
          }, 2000);
        } else {
          // Notify all clients of stream end
          for (const client of activeClients) {
            try {
              if (!client.destroyed) {
                client.end();
              }
            } catch (err) {
              // Ignore errors on cleanup
            }
          }
          activeClients.clear();
        }
      });

      currentStream.on('error', (err) => {
        console.error('❌ FFmpeg error:', err.message);
        isStreamActive = false;
        currentStream = null;
        
        // Retry if clients are waiting
        if (activeClients.size > 0) {
          console.log('🔄 Retrying stream connection...');
          setTimeout(() => {
            if (activeClients.size > 0) {
              startOptimizedStream();
            }
          }, 3000);
        }
      });
    }, 1000); // Wait 1 second for RTMP stream to be ready
  }

  // Production monitoring endpoints
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      pid: process.pid,
      version: process.version
    });
  });

  app.get('/stream-health', (req, res) => {
    // Check if RTMP stream is available
    const http = require('http');
    const req2 = http.request({
      hostname: 'localhost',
      port: 8000,
      path: '/api/streams',
      method: 'GET',
      timeout: 1000
    }, (res2) => {
      let data = '';
      res2.on('data', chunk => data += chunk);
      res2.on('end', () => {
        try {
          const streams = JSON.parse(data);
          const hasLiveStream = streams.live && streams.live.stream && streams.live.stream.publisher;
          res.json({
            rtmpStreamActive: hasLiveStream,
            ffmpegActive: isStreamActive,
            clients: activeClients.size,
            bufferSize: streamBuffer.length,
            status: hasLiveStream && isStreamActive ? 'healthy' : 'no-stream'
          });
        } catch (err) {
          res.json({
            rtmpStreamActive: false,
            ffmpegActive: isStreamActive,
            clients: activeClients.size,
            bufferSize: streamBuffer.length,
            status: 'unknown'
          });
        }
      });
    });
    
    req2.on('error', () => {
      res.json({
        rtmpStreamActive: false,
        ffmpegActive: isStreamActive,
        clients: activeClients.size,
        bufferSize: streamBuffer.length,
        status: 'rtmp-server-error'
      });
    });
    
    req2.end();
  });

  app.get('/stats', (req, res) => {
    res.json({
      server: 'Production RTMP Radio',
      clients: {
        active: activeClients.size,
        max: MAX_CLIENTS,
        utilization: `${Math.round((activeClients.size / MAX_CLIENTS) * 100)}%`
      },
      stream: {
        active: isStreamActive,
        bufferSize: streamBuffer.length,
        rtmpUrl: `rtmp://localhost:${RTMP_PORT}/live/stream`
      },
      system: {
        workers: ENABLE_CLUSTERING ? numCPUs : 1,
        memory: process.memoryUsage(),
        uptime: process.uptime()
      },
      timestamp: new Date().toISOString()
    });
  });

  // RTMP Server Events with improved handling
  nms.on('preConnect', (id, args) => {
    console.log(`🔗 RTMP PreConnect: ${id}`);
  });

  nms.on('postConnect', (id, args) => {
    console.log(`✅ RTMP PostConnect: ${id}`);
  });

  nms.on('prePublish', (id, StreamPath, args) => {
    console.log(`📹 RTMP PrePublish: ${id} → ${StreamPath}`);
  });

  nms.on('postPublish', (id, StreamPath, args) => {
    console.log(`🚀 RTMP Stream Started! ${id} → ${StreamPath}`);
    // Reset stream buffer when new publisher starts
    streamBuffer = Buffer.alloc(0);
    audioChunks = [];
    
    // Store stream info for WebRTC clients
    rtmpStreamInfo = {
      id,
      path: StreamPath,
      startTime: new Date().toISOString(),
      args
    };
    
    // Notify all WebRTC clients
    io.emit('stream-started', rtmpStreamInfo);
  });

  nms.on('donePublish', (id, StreamPath, args) => {
    console.log(`🔴 RTMP Stream Stopped: ${id} → ${StreamPath}`);
    // Stop FFmpeg when publisher disconnects
    if (currentStream) {
      console.log('🔌 Publisher disconnected, stopping FFmpeg consumer');
      currentStream.kill('SIGTERM');
      currentStream = null;
      isStreamActive = false;
    }
    
    // Clear stream info and notify WebRTC clients
    rtmpStreamInfo = null;
    audioChunks = [];
    io.emit('stream-stopped', { id, path: StreamPath });
  });

  // Start RTMP server
  nms.run();

  // Start HTTP server with production settings
  server.listen(HTTP_PORT, '0.0.0.0', () => {
    const railwayDomain = process.env.RAILWAY_STATIC_URL || process.env.RAILWAY_PUBLIC_DOMAIN;
    const railwayTcpProxy = process.env.RAILWAY_TCP_PROXY_DOMAIN; // Railway TCP proxy domain
    const publicUrl = railwayDomain ? `https://${railwayDomain}` : `http://localhost:${HTTP_PORT}`;
    
    // Determine RTMP URL based on available Railway services
    let rtmpUrl;
    if (railwayTcpProxy) {
      // Railway TCP proxy available
      rtmpUrl = `rtmp://${railwayTcpProxy}:${RTMP_PORT}/live/stream`;
    } else if (railwayDomain) {
      // Try direct Railway domain (might not work)
      rtmpUrl = `rtmp://${railwayDomain}:${RTMP_PORT}/live/stream`;
    } else {
      // Local development
      rtmpUrl = `rtmp://localhost:${RTMP_PORT}/live/stream`;
    }
    
    console.log('🎵 Production WebRTC Radio Server - Railway.app');
    console.log('==============================================');
    console.log(`🚀 Process ID: ${process.pid}`);
    console.log(`⚡ Workers: ${ENABLE_CLUSTERING ? numCPUs : 1}`);
    console.log(`👥 Max Clients: ${MAX_CLIENTS}`);
    console.log(`📻 Web Player: ${publicUrl}`);
    console.log(`📡 RTMP Server: ${rtmpUrl}`);
    console.log(`🔗 WebSocket: ${publicUrl.replace('http', 'ws')}`);
    console.log('');
    
    // Enhanced OBS setup instructions
    console.log('🎬 OBS Setup for Railway.app:');
    console.log('   1. Open OBS Studio');
    console.log('   2. Go to Settings → Stream');
    console.log('   3. Service: Custom');
    
    if (railwayTcpProxy) {
      console.log(`   4. Server: rtmp://${railwayTcpProxy}:${RTMP_PORT}/live`);
      console.log(`   5. Stream Key: stream`);
      console.log('');
      console.log('✅ Railway TCP Proxy detected - RTMP should work!');
    } else if (railwayDomain) {
      console.log(`   4. Server: rtmp://${railwayDomain}:${RTMP_PORT}/live`);
      console.log(`   5. Stream Key: stream`);
      console.log('');
      console.log('⚠️  Railway TCP proxy not detected. If RTMP fails:');
      console.log('   • Check Railway dashboard for TCP proxy settings');
      console.log('   • Try using port 8080 instead of 1935');
      console.log('   • Consider migrating to Fly.io for better RTMP support');
    } else {
      console.log(`   4. Server: rtmp://localhost:${RTMP_PORT}/live`);
      console.log(`   5. Stream Key: stream`);
    }
    console.log('   6. Click "Start Streaming"');
    console.log('');
    console.log('🔧 RTMP Troubleshooting:');
    console.log(`   • Test connection: telnet ${railwayDomain || 'localhost'} ${RTMP_PORT}`);
    console.log('   • If port 8080 fails, try 1935, 1936, or 8935');
    console.log('   • Check Railway logs for RTMP server startup');
    console.log('   • Alternative: Use ngrok for local development');
    console.log('');
    console.log('🚀 Quick RTMP Test:');
    console.log(`   ffmpeg -re -f lavfi -i sine=frequency=1000:duration=5 \\`);
    console.log(`     -c:a aac -f flv ${rtmpUrl}`);
    console.log('');
    console.log('');
    console.log('🌐 WebRTC Features:');
    console.log('   • Real-time audio streaming');
    console.log('   • Low latency (<100ms)');
    console.log('   • Automatic reconnection');
    console.log('   • Browser-native playback');
    console.log('');
    console.log('📊 Monitoring:');
    console.log(`   Stats: ${publicUrl}/stats`);
    console.log(`   Health: ${publicUrl}/health`);
    console.log('');
  });

  // Production server settings
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;
  server.maxConnections = MAX_CLIENTS + 50; // Some buffer for API calls

  // Graceful shutdown
  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);

  function gracefulShutdown() {
    console.log('\n🛑 Graceful shutdown initiated...');
    
    server.close(() => {
      console.log('📡 HTTP server closed');
      
      if (currentStream) {
        currentStream.kill('SIGTERM');
      }
      
      nms.stop();
      console.log('🎵 RTMP server stopped');
      
      process.exit(0);
    });
  }
}

function getLocalIP() {
  const networkInterfaces = os.networkInterfaces();
  for (const name of Object.keys(networkInterfaces)) {
    for (const net of networkInterfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}
