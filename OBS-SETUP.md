# OBS + Simple Radio Setup Guide

## 🌐 Device Access Options

### Local Testing
- **Same Computer**: http://localhost:3000

### Network Testing (Other Devices)
- **Any device on your WiFi**: http://192.168.1.188:3000
- **Mobile Phone**: Connect to same WiFi, open browser, go to above URL
- **Other Computers**: Same WiFi network, use above URL

### Internet Access (if needed)
- **Option 1**: Set up ngrok account (free) at https://dashboard.ngrok.com/signup
- **Option 2**: Deploy to cloud service (Heroku, DigitalOcean, etc.)
- **Option 3**: Use local network sharing (current setup works great!)

## Step 1: Start the RTMP Server

```bash
npm run rtmp
```

You should see:
```
🎵 Simple Radio with RTMP Server
================================
📻 Local Web Player: http://localhost:3000
🌐 Network Web Player: http://192.168.1.188:3000
📡 RTMP Server: rtmp://localhost:1935/live/stream
```

## Step 2: Configure OBS Studio

1. **Open OBS Studio**

2. **Go to Settings → Stream**
   - Service: `Custom`
   - Server: `rtmp://localhost:1935/live`
   - Stream Key: `stream`

3. **Add Audio Sources** (optional but recommended)
   - Add "Audio Input Capture" for microphone
   - Add "Audio Output Capture" for desktop audio
   - Or just use "Desktop Audio" if available

4. **Start Streaming**
   - Click "Start Streaming" in OBS
   - You should see "🚀 RTMP Stream Started!" in the terminal

## Step 3: Test the Web Player

### On Your Computer
1. **Open**: http://localhost:3000
2. **Click the play button** ▶️
3. **You should hear your OBS audio stream!**

### On Other Devices (Phone, Tablet, etc.)
1. **Connect device to same WiFi network**
2. **Open browser and go to**: http://192.168.1.188:3000
3. **Click the play button** ▶️
4. **You should hear your OBS audio stream!**

## 📱 Mobile Testing Tips

- **iOS Safari**: May require user interaction before audio plays
- **Android Chrome**: Usually works immediately
- **Use headphones** to prevent feedback if testing in same room
- **Check WiFi**: Make sure mobile device is on same network as your Mac

## Troubleshooting

### "Connection failed" in OBS
- Make sure the server is running
- Check that port 1935 isn't blocked
- Verify the RTMP URL: `rtmp://localhost:1935/live`

### "No audio" in web player
- Make sure OBS is streaming (green dot in bottom right)
- Check that you have audio sources in OBS
- Try refreshing the web page

### "FFmpeg error" in terminal
- Make sure FFmpeg is installed: `ffmpeg -version`
- Check that OBS is actually streaming to the RTMP server

## Advanced: Stream to Multiple Devices

Once this works locally, you can:

1. **Use ngrok for external access**:
   ```bash
   npx ngrok http 3000
   ```

2. **Deploy to a VPS** for permanent streaming

3. **Add authentication** for private streams

## Testing Without OBS

You can test the RTMP server with FFmpeg directly:

```bash
# Stream a test video with audio
ffmpeg -re -f lavfi -i testsrc2=duration=10:size=320x240:rate=30 -f lavfi -i sine=frequency=1000:duration=10 -c:v libx264 -c:a aac -f flv rtmp://localhost:1935/live/stream
```
