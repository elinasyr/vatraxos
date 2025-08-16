# Use Node.js LTS version
FROM node:18-alpine

# Install FFmpeg
RUN apk add --no-cache ffmpeg

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Create media directory
RUN mkdir -p media

# Expose ports
EXPOSE 10000
EXPOSE 1935
EXPOSE 8000

# Set environment variables
ENV NODE_ENV=production
ENV FFMPEG_PATH=/usr/bin/ffmpeg
ENV MEDIA_PATH=/app/media

# Start the application
CMD ["npm", "start"]
