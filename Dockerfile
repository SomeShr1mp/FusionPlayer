# Use Node.js LTS Alpine for smaller image size
# Use the current one if you actually want this thing to work lol
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

# Copy Midicube from node_modules to public/js for easier serving
RUN if [ -f /app/node_modules/midicube/releases/midicube.js ]; then \
        echo "📦 Copying Midicube to public/js/..."; \
        cp /app/node_modules/midicube/releases/midicube.js /app/public/js/midicube.js && \
        echo "✅ Midicube copied successfully"; \
        ls -la /app/public/js/midicube.js; \
    else \
        echo "❌ Midicube not found in node_modules - MIDI SoundFont support will be unavailable"; \
        echo "   Expected: /app/node_modules/midicube/releases/midicube.js"; \
        ls -la /app/node_modules/midicube/ 2>/dev/null || echo "   Midicube directory not found"; \
    fi

# Verify Midicube installation and copy
RUN if [ -f /app/node_modules/midicube/package.json ]; then \
        echo "✅ Midicube npm package installed successfully"; \
        echo "📋 Midicube version: $(cat /app/node_modules/midicube/package.json | grep '"version"' | cut -d'"' -f4)"; \
        ls -la /app/node_modules/midicube/releases/ || echo "⚠️  Midicube releases folder not found"; \
    else \
        echo "❌ Midicube npm package not found"; \
        echo "🔍 Available node_modules:"; \
        ls -la /app/node_modules/ | head -10; \
    fi

# Verify the copied file is accessible
RUN if [ -f /app/public/js/midicube.min.js ]; then \
        echo "✅ Midicube.min.js successfully copied to public/js/"; \
        echo "📊 File size: $(du -h /app/public/js/midicube.js | cut -f1)"; \
    else \
        echo "❌ Midicube.js not found in public/js/ - creating placeholder"; \
        echo "// Midicube placeholder - real file not found during build" > /app/public/js/midicube.js; \
    fi

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
