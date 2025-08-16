#!/bin/bash

# Railway.app RTMP Connection Test Script

echo "🧪 Testing RTMP Connection to Railway.app"
echo "=========================================="

# Get your Railway app URL (replace with yours)
RAILWAY_URL="vatraxos-radio-production.up.railway.app"

# Test different RTMP ports
PORTS=(1935 8080 1936 8935)

for PORT in "${PORTS[@]}"; do
    echo ""
    echo "Testing port $PORT..."
    
    # Test TCP connection
    timeout 5 bash -c "</dev/tcp/$RAILWAY_URL/$PORT" 2>/dev/null
    if [ $? -eq 0 ]; then
        echo "✅ Port $PORT is OPEN and accessible"
        echo "🎯 Try this in OBS:"
        echo "   Server: rtmp://$RAILWAY_URL:$PORT/live"
        echo "   Stream Key: stream"
    else
        echo "❌ Port $PORT is CLOSED or blocked"
    fi
done

echo ""
echo "🔍 Alternative Tests:"
echo "• Check Railway dashboard for TCP proxy settings"
echo "• Try running: railway logs --follow"
echo "• Test locally first: rtmp://localhost:8080/live/stream"

echo ""
echo "💡 If all ports fail, consider:"
echo "• Using Fly.io instead (better RTMP support)"
echo "• Using ngrok for development"
echo "• Hybrid approach: Railway for web + external RTMP service"
