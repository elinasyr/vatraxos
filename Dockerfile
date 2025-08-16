# Use Node.js LTS version
FROM node:18-alpine

# Install FFmpeg and other necessary packages
RUN apk add --no-cache ffmpeg curl

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY . .

# Create media directory
RUN mkdir -p media

# Create non-root user for security (Cloud Run best practice)
RUN addgroup -g 1001 -S appuser && \
    adduser -S appuser -u 1001 && \
    chown -R appuser:appuser /app
USER appuser

# Expose port 8080 (Cloud Run default)
EXPOSE 8080

# Set environment variables for Cloud Run
ENV NODE_ENV=production
ENV PORT=8080
ENV FFMPEG_PATH=/usr/bin/ffmpeg
ENV MEDIA_PATH=/app/media
ENV CLOUD_RUN=true
ENV DISABLE_RTMP=true

# Health check for Cloud Run
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:${PORT:-8080}/health || exit 1

# Start the application
CMD ["node", "production-server.js"]
