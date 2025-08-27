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

# Create the OpenMPT loader script
RUN cat > /app/public/js/openmpt-loader.js << 'EOF'
// OpenMPT Loader - Fixes the global variable issue between libopenmpt and chiptune2
(function() {
    'use strict';
    console.log('[OpenMPT Loader] Initializing...');
    
    const moduleConfig = {
        preRun: [],
        postRun: [],
        print: function(text) { console.log('[OpenMPT]', text); },
        printErr: function(text) { console.error('[OpenMPT Error]', text); },
        locateFile: function(filename) {
            if (filename.endsWith('.mem') || filename.endsWith('.wasm')) {
                console.log('[OpenMPT Loader] Locating file:', filename);
                return '/js/' + filename;
            }
            return filename;
        },
        onRuntimeInitialized: function() {
            console.log('[OpenMPT Loader] Runtime initialized');
            if (typeof Module !== 'undefined') {
                window.libopenmpt = Module;
                console.log('[OpenMPT Loader] Set window.libopenmpt = Module');
                
                if (Module.UTF8ToString && !window.UTF8ToString) {
                    window.UTF8ToString = Module.UTF8ToString;
                }
                if (Module.writeAsciiToMemory && !window.writeAsciiToMemory) {
                    window.writeAsciiToMemory = Module.writeAsciiToMemory;
                }
                
                const event = new CustomEvent('openmptReady', { 
                    detail: { module: Module, version: 'libopenmpt' }
                });
                window.dispatchEvent(event);
            }
        },
        INITIAL_MEMORY: 33554432,
        ALLOW_MEMORY_GROWTH: 1,
        MAXIMUM_MEMORY: 536870912,
        ENVIRONMENT: 'web'
    };
    
    if (typeof Module === 'undefined') {
        window.Module = moduleConfig;
    } else {
        for (let key in moduleConfig) {
            if (!Module.hasOwnProperty(key)) {
                Module[key] = moduleConfig[key];
            }
        }
        const originalOnRuntimeInitialized = Module.onRuntimeInitialized;
        Module.onRuntimeInitialized = function() {
            if (originalOnRuntimeInitialized) {
                originalOnRuntimeInitialized.call(this);
            }
            moduleConfig.onRuntimeInitialized.call(this);
        };
    }
    
    if (typeof Module !== 'undefined' && Module._openmpt_module_create_from_memory) {
        window.libopenmpt = Module;
        if (Module.UTF8ToString && !window.UTF8ToString) {
            window.UTF8ToString = Module.UTF8ToString;
        }
        if (Module.writeAsciiToMemory && !window.writeAsciiToMemory) {
            window.writeAsciiToMemory = Module.writeAsciiToMemory;
        }
    }
})();

window.checkOpenMPTStatus = function() {
    const status = {
        moduleExists: typeof Module !== 'undefined',
        libopenmptExists: typeof libopenmpt !== 'undefined',
        hasCreateFunction: false,
        ready: false
    };
    
    if (typeof Module !== 'undefined') {
        status.hasCreateFunction = typeof Module._openmpt_module_create_from_memory === 'function';
    }
    
    if (typeof libopenmpt !== 'undefined') {
        if (!status.hasCreateFunction) {
            status.hasCreateFunction = typeof libopenmpt._openmpt_module_create_from_memory === 'function';
        }
    }
    
    status.ready = status.moduleExists && status.libopenmptExists && status.hasCreateFunction;
    return status;
};
EOF

# Download webaudio-tinysynth for MIDI playback
RUN curl -L -f -o /app/public/js/webaudio-tinysynth.js \
    https://g200kg.github.io/webaudio-tinysynth/webaudio-tinysynth.js || \
    echo "TinySynth download failed - MIDI support will be limited"

# Download a compact SoundFont (optional, for enhanced MIDI)
RUN curl -L -f -o /app/public/soundfonts/default.sf2 \
    https://archive.org/download/free-soundfonts-sf2-2019-04/FluidR3%20GM.sf2 || \
    echo "Default SoundFont download failed - will use TinySynth built-in sounds"

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
