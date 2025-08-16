#!/bin/bash

echo "🎬 Testing Fixed Production Server"
echo "================================="
echo ""

echo "1️⃣ Checking server health..."
curl -s http://localhost:3000/stream-health | python3 -m json.tool 2>/dev/null || curl -s http://localhost:3000/stream-health

echo ""
echo "2️⃣ Starting OBS test stream..."

# Start a continuous test stream (instead of 10 seconds)
ffmpeg -re \
  -f lavfi -i "testsrc2=size=320x240:rate=30" \
  -f lavfi -i "sine=frequency=440" \
  -c:v libx264 -preset ultrafast -tune zerolatency \
  -c:a aac -b:a 128k \
  -f flv rtmp://localhost:1935/live/stream \
  > /tmp/obs-test-fixed.log 2>&1 &

FFMPEG_PID=$!
echo "🎵 Started continuous test stream (PID: $FFMPEG_PID)"

# Wait for stream to establish
echo "⏳ Waiting for stream to establish..."
sleep 5

echo ""
echo "3️⃣ Checking stream status after establishment..."
curl -s http://localhost:3000/stream-health | python3 -m json.tool 2>/dev/null || curl -s http://localhost:3000/stream-health

echo ""
echo "4️⃣ Testing web client connection..."
timeout 5 curl -s http://localhost:3000/stream | head -c 1000 > /tmp/stream-test.dat
if [ -s /tmp/stream-test.dat ]; then
    echo "✅ Web stream is working ($(wc -c < /tmp/stream-test.dat) bytes received)"
else
    echo "❌ Web stream failed"
fi

echo ""
echo "5️⃣ Simulating multiple clients..."
for i in {1..3}; do
    timeout 3 curl -s http://localhost:3000/stream > /dev/null &
    echo "🎧 Started test client $i"
done

sleep 2

echo ""
echo "6️⃣ Final stats check..."
curl -s http://localhost:3000/stats | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(f\"📊 Active clients: {data['clients']['active']}\")
print(f\"🎵 Stream active: {data['stream']['active']}\")
print(f\"📦 Buffer size: {data['stream']['bufferSize']} bytes\")
print(f\"💾 Memory usage: {round(data['system']['memory']['heapUsed']/1024/1024, 1)}MB\")
"

echo ""
echo "✅ Test complete! Stream will continue running..."
echo ""
echo "🎬 Now you can:"
echo "   1. Configure OBS with: rtmp://localhost:1935/live (key: stream)"
echo "   2. Open web player: http://localhost:3000"
echo "   3. Monitor stats: http://localhost:3000/stats"
echo ""
echo "⏹️  To stop test stream: kill $FFMPEG_PID"

# Don't wait for ffmpeg to finish, let it run
echo "🔄 Test stream running in background..."
