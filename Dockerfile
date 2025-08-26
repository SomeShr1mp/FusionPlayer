# Use Node.js LTS Alpine for smaller image size
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install system dependencies including wget for healthcheck
RUN apk add --no-cache \
    curl \
    wget \
    dumb-init \
    && rm -rf /var/cache/apk/*

# Create app user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S musicplayer -u 1001 -G nodejs

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p /app/public/js /app/public/css /app/public/soundfonts /app/public/music /app/logs

# Download audio libraries with error handling
RUN set -e && \
    echo "Downloading chiptune2.js..." && \
    curl -L -f -o /app/public/js/libopenmpt.js \
    https://cdn.jsdelivr.net/gh/deskjet/chiptune2.js@master/libopenmpt.js && \
    curl -L -f -o /app/public/js/libopenmpt.js.mem \
    https://cdn.jsdelivr.net/gh/deskjet/chiptune2.js@master/libopenmpt.js.mem && \
    curl -L -f -o /app/public/js/chiptune2.js \
    https://cdn.jsdelivr.net/gh/deskjet/chiptune2.js@master/chiptune2.js && \
    echo "Chiptune2.js downloaded successfully"

# Download js-synthesizer with fallback
RUN set -e && \
    echo "Downloading js-synthesizer..." && \
    (curl -L -f -o /app/public/js/libfluidsynth-2.3.0.js \
    https://cdn.jsdelivr.net/npm/js-synthesizer@1.8.5/externals/libfluidsynth-2.3.0.js && \
    curl -L -f -o /app/public/js/js-synthesizer.js \
    https://cdn.jsdelivr.net/npm/js-synthesizer@1.8.5/dist/js-synthesizer.js) || \
    echo "JS-Synthesizer download failed, will use fallback"

# Download webaudio-tinysynth as fallback
RUN curl -L -f -o /app/public/js/webaudio-tinysynth.js \
    https://g200kg.github.io/webaudio-tinysynth/webaudio-tinysynth.js || \
    echo "TinySynth download failed"

# Download a compact SoundFont
RUN curl -L -f -o /app/public/soundfonts/default.sf2 \
    https://archive.org/download/free-soundfonts-sf2-2019-04/FluidR3%20GM.sf2 || \
    echo "Default SoundFont download failed"

# Set correct permissions
RUN chown -R musicplayer:nodejs /app

# Switch to non-root user
USER musicplayer

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "server.js"]
