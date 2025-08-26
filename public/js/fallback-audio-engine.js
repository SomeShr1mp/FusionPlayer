// Fallback AudioEngine - Works without AudioWorklet for maximum compatibility
class FallbackAudioEngine {
    constructor() {
        this.audioContext = null;
        this.gainNode = null;
        this.volume = 0.5;
        this.isPlaying = false;
        this.isPaused = false;
        this.currentTime = 0;
        this.duration = 0;
        
        // Audio engines
        this.modulePlayer = null;
        this.chiptunePlayer = null;
        this.synthesizer = null;
        this.tinySynth = null;
        this.synthesizerReady = false;
        
        // Fallback mode is always true for this engine
        this.fallbackMode = true;
        this.useAudioWorklet = false;
        
        this.uiController = null;
        this.progressInterval = null;
        this.midiPlaybackContext = null;
        
        // Playback state
        this.currentPlayback = null;
        this.playbackType = null;
        
        console.log('🎵 FallbackAudioEngine v2.0 initialized (no AudioWorklet)');
    }
    
    setUIController(uiController) {
        this.uiController = uiController;
    }
    
    async initialize() {
        try {
            this.updateStatus('Initializing fallback audio engine...');
            
            // Initialize Web Audio Context (safely)
            await this.initializeAudioContext();
            
            // Skip AudioWorklet initialization entirely in fallback mode
            this.updateStatus('AudioWorklet skipped - using direct library approach');
            
            // Initialize audio engines with better error handling
            await this.initializeAudioEngines();
            
            // Setup user activation handlers
            this.setupUserActivation();
            
            this.updateStatus('Fallback audio engine ready ✓');
            console.log('✅ FallbackAudioEngine initialized successfully');
            
            return true;
            
        } catch (error) {
            this.updateStatus('Fallback audio engine initialization failed: ' + error.message);
            console.error('FallbackAudioEngine initialization error:', error);
            throw error;
        }
    }
    
    async initializeAudioContext() {
        try {
            // Safe AudioContext creation
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) {
                throw new Error('Web Audio API not supported');
            }
            
            this.audioContext = new AudioContext();
            
            // Create gain node with error handling
            this.gainNode = this.audioContext.createGain();
            this.gainNode.connect(this.audioContext.destination);
            this.gainNode.gain.value = this.volume;
            
            // Add state change listener
            this.audioContext.addEventListener('statechange', () => {
                this.updateStatus(`Audio context: ${this.audioContext.state}`);
            });
            
            this.updateStatus(`Audio context initialized (${this.audioContext.state}) ✓`);
            
        } catch (error) {
            console.error('AudioContext initialization failed:', error);
            throw new Error(`AudioContext initialization failed: ${error.message}`);
        }
    }
    
    async initializeAudioEngines() {
        const engines = [];
        
        // Initialize OpenMPT/Chiptune2.js with better detection
        try {
            this.updateStatus('Initializing OpenMPT/ChiptuneJS engine...');
            await this.initializeOpenMPT();
            engines.push('OpenMPT/ChiptuneJS');
        } catch (error) {
            console.warn('OpenMPT initialization failed:', error);
            this.updateStatus('OpenMPT initialization failed: ' + error.message);
        }
        
        // Initialize TinySynth with better detection
        try {
            this.updateStatus('Initializing TinySynth engine...');
            await this.initializeTinySynth();
            engines.push('TinySynth');
        } catch (error) {
            console.warn('TinySynth initialization failed:', error);
            this.updateStatus('TinySynth initialization failed: ' + error.message);
        }
        
        if (engines.length === 0) {
            throw new Error('No audio engines could be initialized');
        }
        
        this.updateStatus(`Audio engines ready: ${engines.join(', ')} ✓`);
    }
    
    async initializeOpenMPT() {
        this.updateStatus('Checking for OpenMPT libraries...');
        
        // Wait for libraries to load with timeout
        let attempts = 0;
        const maxAttempts = 30; // Reduced timeout to avoid hanging
        
        while (attempts < maxAttempts) {
            // Check for any available OpenMPT implementation
            if (typeof ChiptuneJsConfig !== 'undefined' && typeof ChiptuneJsPlayer !== 'undefined') {
                break;
            }
            if (typeof Module !== 'undefined') {
                break;
            }
            
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        if (attempts >= maxAttempts) {
            this.updateStatus('OpenMPT libraries not found - tracker files will not work');
            console.warn('⚠️ OpenMPT libraries not found after waiting');
            return; // Don't throw - continue without tracker support
        }
        
        // Try to initialize ChiptuneJS player
        if (typeof ChiptuneJsConfig !== 'undefined' && typeof ChiptuneJsPlayer !== 'undefined') {
            try {
                this.updateStatus('Creating ChiptuneJS player...');
                
                // Check if OpenMPT WASM is actually available
                let wasmWorking = false;
                try {
                    if (typeof Module !== 'undefined' && Module._openmpt_module_create_from_memory) {
                        wasmWorking = true;
                        console.log('✅ OpenMPT WASM functions detected');
                    }
                } catch (wasmError) {
                    console.warn('⚠️ OpenMPT WASM check failed:', wasmError);
                }
                
                if (!wasmWorking) {
                    this.updateStatus('OpenMPT WASM not working - tracker files will not play');
                    console.warn('⚠️ OpenMPT WASM not working - skipping ChiptuneJS player');
                    return; // Don't throw - continue without tracker support
                }
                
                // Create ChiptuneJS player with fallback context
                this.chiptunePlayer = new ChiptuneJsPlayer(new ChiptuneJsConfig(-1, this.audioContext));
                
                // Setup event handlers
                if (this.chiptunePlayer.onEnded) {
                    this.chiptunePlayer.onEnded = () => {
                        this.handleTrackEnd();
                    };
                }
                
                if (this.chiptunePlayer.onError) {
                    this.chiptunePlayer.onError = (error) => {
                        this.handlePlaybackError('ChiptuneJS error', error);
                    };
                }
                
                console.log('✅ ChiptuneJS player initialized');
                this.updateStatus('ChiptuneJS player ready ✓');
                
            } catch (error) {
                console.warn('ChiptuneJS player creation failed:', error);
                this.chiptunePlayer = null;
                this.updateStatus('ChiptuneJS player failed - tracker files will not work');
                // Don't throw - continue without tracker support
            }
        } else if (typeof Module !== 'undefined') {
            console.log('✅ Raw OpenMPT module available');
            this.modulePlayer = Module;
            this.updateStatus('Raw OpenMPT module ready ✓');
        } else {
            this.updateStatus('No OpenMPT implementation available - tracker files will not work');
            console.warn('⚠️ No suitable OpenMPT implementation found');
            // Don't throw - continue without tracker support
        }
    }
    
    async initializeTinySynth() {
        this.updateStatus('Checking for TinySynth...');
        
        // Wait for TinySynth library
        let attempts = 0;
        const maxAttempts = 50;
        
        while (typeof WebAudioTinySynth === 'undefined' && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        if (attempts >= maxAttempts) {
            throw new Error('WebAudioTinySynth library not found');
        }
        
        try {
            this.updateStatus('Creating TinySynth instance...');
            
            // Create TinySynth with optimal settings for fallback mode
            this.tinySynth = new WebAudioTinySynth({
                quality: 1,
                useReverb: 0, // Disable reverb for better compatibility
                voices: 16,   // Reduce voices for better performance
                context: this.audioContext
            });
            
            // Connect to gain node if possible
            if (this.tinySynth.getAudioContext && this.tinySynth.getAudioContext() === this.audioContext) {
                console.log('✅ TinySynth connected to main audio context');
            }
            
            this.synthesizerReady = true;
            this.synthesizer = this.tinySynth; // For compatibility
            
            console.log('✅ TinySynth initialized');
            this.updateStatus('TinySynth ready ✓');
            
        } catch (error) {
            console.warn('TinySynth initialization failed:', error);
            this.tinySynth = null;
            this.synthesizerReady = false;
            throw error;
        }
    }
    
    setupUserActivation() {
        const activateAudio = async () => {
            if (this.audioContext && this.audioContext.state === 'suspended') {
                try {
                    await this.audioContext.resume();
                    this.updateStatus('Audio context activated ✓');
                    console.log('🔊 Audio context activated by user interaction');
                } catch (error) {
                    console.error('Failed to activate audio context:', error);
                }
            }
        };
        
        // Setup activation on various user interactions
        const events = ['click', 'touchstart', 'keydown'];
        events.forEach(event => {
            document.addEventListener(event, activateAudio, { once: true });
        });
    }
    
    async playTrack(trackData) {
        if (!trackData) {
            throw new Error('No track data provided');
        }
        
        try {
            // Stop any current playback
            this.stop();
            
            const trackUrl = `/music/${trackData.filename}`;
            this.updateStatus(`Loading ${trackData.filename}...`);
            
            // Ensure audio context is ready
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
            
            if (trackData.type === 'tracker') {
                await this.playTrackerModule(trackUrl, trackData);
            } else if (trackData.type === 'midi') {
                await this.playMidiFile(trackUrl, trackData);
            } else {
                throw new Error(`Unsupported file type: ${trackData.type}`);
            }
            
            this.isPlaying = true;
            this.isPaused = false;
            this.playbackType = trackData.type;
            
            // Start progress monitoring
            this.startProgressMonitoring();
            
            this.updateStatus(`Playing: ${trackData.filename} ♪`);
            
        } catch (error) {
            this.handlePlaybackError('Playback failed', error);
            throw error;
        }
    }
    
    async playTrackerModule(url, trackData) {
        // Check if we have any working tracker player
        if (!this.chiptunePlayer && !this.modulePlayer) {
            throw new Error('No tracker module player available - OpenMPT WASM loading failed');
        }
        
        // Verify WASM is actually working
        try {
            if (typeof Module === 'undefined' || !Module._openmpt_module_create_from_memory) {
                throw new Error('OpenMPT WASM module not functional - WASM loading failed');
            }
        } catch (wasmError) {
            throw new Error(`OpenMPT WASM check failed: ${wasmError.message}. This is usually caused by server configuration issues with WASM files.`);
        }
        
        if (!this.chiptunePlayer) {
            throw new Error('ChiptuneJS player not available');
        }
        
        try {
            this.updateStatus('Downloading tracker module...');
            
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const buffer = await response.arrayBuffer();
            this.updateStatus('Tracker module downloaded, starting playback...');
            
            // Try direct play method first
            if (typeof this.chiptunePlayer.play === 'function') {
                try {
                    this.chiptunePlayer.play(buffer);
                    this.currentPlayback = { type: 'chiptune', player: this.chiptunePlayer };
                    this.updateStatus('ChiptuneJS direct play successful ✓');
                    return;
                } catch (playError) {
                    this.updateStatus(`Direct play failed: ${playError.message}, trying callback method...`);
                }
            }
            
            // Try callback-based loading
            if (typeof this.chiptunePlayer.load === 'function') {
                return new Promise((resolve, reject) => {
                    this.chiptunePlayer.load(buffer, (error) => {
                        if (error) {
                            reject(new Error(`ChiptuneJS load error: ${error}`));
                        } else {
                            try {
                                this.chiptunePlayer.play();
                                this.currentPlayback = { type: 'chiptune', player: this.chiptunePlayer };
                                this.updateStatus('ChiptuneJS callback play successful ✓');
                                resolve();
                            } catch (playError) {
                                reject(new Error(`ChiptuneJS play error: ${playError.message}`));
                            }
                        }
                    });
                });
            }
            
            throw new Error('No suitable ChiptuneJS play method found');
            
        } catch (error) {
            throw new Error(`Tracker module playback failed: ${error.message}`);
        }
    }
    
    async playMidiFile(url, trackData) {
        if (!this.tinySynth || !this.synthesizerReady) {
            throw new Error('TinySynth not available or not ready');
        }
        
        try {
            this.updateStatus('Downloading MIDI file...');
            
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const buffer = await response.arrayBuffer();
            this.updateStatus('MIDI file downloaded, starting playback...');
            
            // Try different TinySynth loading methods
            if (typeof this.tinySynth.loadMIDIUrl === 'function') {
                // Method 1: loadMIDIUrl with blob
                const blob = new Blob([new Uint8Array(buffer)], { type: 'audio/midi' });
                const blobUrl = URL.createObjectURL(blob);
                
                await this.tinySynth.loadMIDIUrl(blobUrl);
                this.tinySynth.playMIDI();
                
                this.currentPlayback = { type: 'midi', player: this.tinySynth, url: blobUrl };
                this.updateStatus('TinySynth MIDI playback started (URL method) ✓');
                
                // Clean up blob URL after a delay
                setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
                return;
            }
            
            if (typeof this.tinySynth.loadMIDI === 'function') {
                // Method 2: loadMIDI with Uint8Array
                const uint8Array = new Uint8Array(buffer);
                this.tinySynth.loadMIDI(uint8Array);
                
                // Try different play methods
                if (typeof this.tinySynth.play === 'function') {
                    this.tinySynth.play();
                } else if (typeof this.tinySynth.playMIDI === 'function') {
                    this.tinySynth.playMIDI();
                } else {
                    throw new Error('No suitable TinySynth play method found');
                }
                
                this.currentPlayback = { type: 'midi', player: this.tinySynth };
                this.updateStatus('TinySynth MIDI playback started (direct method) ✓');
                return;
            }
            
            throw new Error('No suitable TinySynth loading method found');
            
        } catch (error) {
            throw new Error(`MIDI playback failed: ${error.message}`);
        }
    }
    
    pause() {
        if (!this.isPlaying) return;
        
        try {
            this.isPaused = true;
            
            if (this.currentPlayback?.type === 'chiptune' && this.chiptunePlayer) {
                if (typeof this.chiptunePlayer.togglePause === 'function') {
                    this.chiptunePlayer.togglePause();
                } else if (typeof this.chiptunePlayer.pause === 'function') {
                    this.chiptunePlayer.pause();
                }
            } else if (this.currentPlayback?.type === 'midi' && this.tinySynth) {
                if (typeof this.tinySynth.pause === 'function') {
                    this.tinySynth.pause();
                }
                // For MIDI, we might need to send all notes off
                this.sendAllNotesOff();
            }
            
            this.stopProgressMonitoring();
            this.updateStatus('Paused ⏸');
            
        } catch (error) {
            this.handlePlaybackError('Pause failed', error);
        }
    }
    
    resume() {
        if (!this.isPaused) return;
        
        try {
            this.isPaused = false;
            
            if (this.currentPlayback?.type === 'chiptune' && this.chiptunePlayer) {
                if (typeof this.chiptunePlayer.togglePause === 'function') {
                    this.chiptunePlayer.togglePause();
                } else if (typeof this.chiptunePlayer.resume === 'function') {
                    this.chiptunePlayer.resume();
                }
            } else if (this.currentPlayback?.type === 'midi' && this.tinySynth) {
                if (typeof this.tinySynth.resume === 'function') {
                    this.tinySynth.resume();
                } else if (typeof this.tinySynth.playMIDI === 'function') {
                    this.tinySynth.playMIDI();
                }
            }
            
            this.startProgressMonitoring();
            this.updateStatus('Playing ♪');
            
        } catch (error) {
            this.handlePlaybackError('Resume failed', error);
        }
    }
    
    stop() {
        try {
            this.isPlaying = false;
            this.isPaused = false;
            this.currentTime = 0;
            
            if (this.currentPlayback?.type === 'chiptune' && this.chiptunePlayer) {
                if (typeof this.chiptunePlayer.stop === 'function') {
                    this.chiptunePlayer.stop();
                }
            } else if (this.currentPlayback?.type === 'midi' && this.tinySynth) {
                if (typeof this.tinySynth.stop === 'function') {
                    this.tinySynth.stop();
                } else if (typeof this.tinySynth.stopMIDI === 'function') {
                    this.tinySynth.stopMIDI();
                }
                this.sendAllNotesOff();
            }
            
            // Clean up current playback
            if (this.currentPlayback?.url) {
                URL.revokeObjectURL(this.currentPlayback.url);
            }
            
            this.currentPlayback = null;
            this.playbackType = null;
            
            this.stopProgressMonitoring();
            this.updateStatus('Stopped ⏹');
            
        } catch (error) {
            this.handlePlaybackError('Stop failed', error);
        }
    }
    
    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
        
        if (this.gainNode) {
            this.gainNode.gain.value = this.volume;
        }
        
        // Set volume on TinySynth if available
        if (this.tinySynth && typeof this.tinySynth.setVolume === 'function') {
            this.tinySynth.setVolume(this.volume);
        }
        
        if (this.uiController) {
            this.uiController.updateVolume(this.volume);
        }
    }
    
    sendAllNotesOff() {
        if (this.tinySynth && typeof this.tinySynth.send === 'function') {
            try {
                // Send All Notes Off and All Sound Off for all channels
                for (let channel = 0; channel < 16; channel++) {
                    this.tinySynth.send([0xB0 | channel, 123, 0], 0); // All notes off
                    this.tinySynth.send([0xB0 | channel, 120, 0], 0); // All sound off
                }
            } catch (error) {
                console.warn('Error sending all notes off:', error);
            }
        }
    }
    
    startProgressMonitoring() {
        this.stopProgressMonitoring();
        
        this.progressInterval = setInterval(() => {
            try {
                let currentTime = 0;
                let duration = 0;
                
                // Get progress from current player
                if (this.currentPlayback?.type === 'chiptune' && this.chiptunePlayer) {
                    if (typeof this.chiptunePlayer.getPosition === 'function') {
                        currentTime = this.chiptunePlayer.getPosition() || 0;
                    }
                    if (typeof this.chiptunePlayer.getDuration === 'function') {
                        duration = this.chiptunePlayer.getDuration() || 0;
                    }
                } else if (this.currentPlayback?.type === 'midi' && this.tinySynth) {
                    if (typeof this.tinySynth.getPlayTime === 'function') {
                        currentTime = this.tinySynth.getPlayTime() || 0;
                    }
                    if (typeof this.tinySynth.getTotalTime === 'function') {
                        duration = this.tinySynth.getTotalTime() || 0;
                    }
                }
                
                this.currentTime = currentTime;
                this.duration = duration;
                
                if (this.uiController) {
                    this.uiController.updateProgress(this.currentTime, this.duration);
                }
                
                // Check if playback ended
                if (duration > 0 && currentTime >= duration) {
                    this.handleTrackEnd();
                }
                
            } catch (error) {
                console.warn('Progress monitoring error:', error);
            }
        }, 100);
    }
    
    stopProgressMonitoring() {
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
        }
    }
    
    handleTrackEnd() {
        this.isPlaying = false;
        this.isPaused = false;
        this.stopProgressMonitoring();
        this.updateStatus('Track ended');
        
        if (this.uiController) {
            this.uiController.handleTrackEnd();
        }
    }
    
    handlePlaybackError(context, error) {
        console.error(`${context}:`, error);
        this.updateStatus(`ERROR: ${context} - ${error.message}`);
        
        if (this.uiController) {
            this.uiController.showError(`${context}: ${error.message}`);
        }
        
        // Stop playback on error
        this.stop();
    }
    
    updateStatus(message) {
        console.log('🎵 [Fallback]', message);
        
        if (this.uiController) {
            this.uiController.updateSystemStatus(message);
        }
    }
    
    // Public API methods for compatibility
    getStatus() {
        return {
            isPlaying: this.isPlaying,
            isPaused: this.isPaused,
            currentTime: this.currentTime,
            duration: this.duration,
            volume: this.volume,
            useAudioWorklet: this.useAudioWorklet,
            fallbackMode: this.fallbackMode,
            synthesizerReady: this.synthesizerReady,
            playbackType: this.playbackType,
            hasChiptunePlayer: !!this.chiptunePlayer,
            hasTinySynth: !!this.tinySynth
        };
    }
    
    // Diagnostic methods
    async runDiagnostics() {
        const diagnostics = {
            audioContext: {
                state: this.audioContext?.state,
                sampleRate: this.audioContext?.sampleRate,
                baseLatency: this.audioContext?.baseLatency
            },
            engines: {
                chiptunePlayer: !!this.chiptunePlayer,
                tinySynth: !!this.tinySynth,
                synthesizerReady: this.synthesizerReady
            },
            playback: {
                isPlaying: this.isPlaying,
                isPaused: this.isPaused,
                currentTime: this.currentTime,
                duration: this.duration,
                playbackType: this.playbackType
            },
            libraries: {
                Module: typeof Module !== 'undefined',
                ChiptuneJsConfig: typeof ChiptuneJsConfig !== 'undefined',
                ChiptuneJsPlayer: typeof ChiptuneJsPlayer !== 'undefined',
                WebAudioTinySynth: typeof WebAudioTinySynth !== 'undefined'
            }
        };
        
        console.log('🔍 FallbackAudioEngine Diagnostics:', diagnostics);
        return diagnostics;
    }
}
