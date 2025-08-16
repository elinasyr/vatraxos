#!/bin/bash

echo "🎬 Testing Production OBS Connection"
echo "===================================="
echo ""

echo "1️⃣ Server Status Check..."
curl -s http://localhost:3000/stats | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(f\"✅ Server: {data['server']}\")
print(f\"👥 Max Clients: {data['clients']['max']}\")
print(f\"📊 Current Load: {data['clients']['utilization']}\")
print(f\"💾 Memory: {round(data['system']['memory']['heapUsed']/1024/1024, 1)}MB\")
print(f\"⏱️  Uptime: {round(data['system']['uptime'], 1)}s\")
"

echo ""
echo "2️⃣ Testing RTMP Connection with FFmpeg..."

# Test RTMP stream
ffmpeg -re \
  -f lavfi -i "testsrc2=duration=10:size=320x240:rate=30" \
  -f lavfi -i "sine=frequency=1000:duration=10" \
  -c:v libx264 -preset ultrafast \
  -c:a aac \
  -f flv rtmp://localhost:1935/live/stream \
  > /tmp/obs-test.log 2>&1 &

FFMPEG_PID=$!
echo "🎵 Started test stream (PID: $FFMPEG_PID)"

sleep 3

echo ""
echo "3️⃣ Checking stream status..."
curl -s http://localhost:3000/stats | python3 -c "
import sys, json
data = json.load(sys.stdin)
if data['stream']['active']:
    print('✅ Stream is ACTIVE')
    print(f'📊 Buffer size: {data[\"stream\"][\"bufferSize\"]} bytes')
else:
    print('❌ Stream is NOT active')
"

echo ""
echo "4️⃣ Testing web client connection..."
curl -s -m 2 http://localhost:3000/stream | head -c 100 > /dev/null && echo "✅ Web stream is working" || echo "❌ Web stream failed"

echo ""
echo "🎧 OBS Setup Instructions:"
echo "   Service: Custom"
echo "   Server: rtmp://localhost:1935/live"
echo "   Stream Key: stream"
echo ""
echo "🌐 Test the web player: http://localhost:3000"
echo "📊 Monitor stats: http://localhost:3000/stats"

# Wait for test to complete
wait $FFMPEG_PID 2>/dev/null

echo ""
echo "🏁 Test stream finished"
echo "📋 Check /tmp/obs-test.log for any RTMP errors"
