# Use Node.js LTS Alpine for smaller image size
FROM node:current-alpine

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

# Download OpenMPT/chiptune2.js with proper WASM support
RUN set -e && \
    echo "Downloading OpenMPT/chiptune2.js..." && \
    curl -L -f -o /app/public/js/libopenmpt.js \
    https://cdn.jsdelivr.net/gh/deskjet/chiptune2.js@master/libopenmpt.js && \
    curl -L -f -o /app/public/js/libopenmpt.js.mem \
    https://cdn.jsdelivr.net/gh/deskjet/chiptune2.js@master/libopenmpt.js.mem && \
    curl -L -f -o /app/public/js/chiptune2.js \
    https://cdn.jsdelivr.net/gh/deskjet/chiptune2.js@master/chiptune2.js && \
    echo "OpenMPT/chiptune2.js downloaded successfully"

# Download webaudio-tinysynth for MIDI playback
RUN curl -L -f -o /app/public/js/webaudio-tinysynth.js \
    https://g200kg.github.io/webaudio-tinysynth/webaudio-tinysynth.js || \
    echo "TinySynth download failed - MIDI support will be limited"

# Download SpessaSynth library
RUN curl -L -f -o /app/public/js/spessasynth.js \
    https://cdn.jsdelivr.net/gh/spessasus/spessasynth_lib/index.js || \
    echo "SpessaSynth download failed - will use TinySynth only"

# Download a compact SoundFont (optional, for enhanced MIDI)
RUN curl -L -f -o /app/public/soundfonts/default.sf2 \
    https://files.maxdevnet.cc/Music/SoundFonts/default.sf2 || \
    echo "Default SoundFont download failed - will use TinySynth built-in sounds"




# Note: The openmpt-loader.js file should be created separately and placed in public/js/
# If it doesn't exist, the application will still work but might have compatibility issues

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
