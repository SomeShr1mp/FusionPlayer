// Enhanced AudioEngine - Updated with SpessaSynth support
class AudioEngine {
    constructor() {
        this.audioContext = null;
        this.gainNode = null;
        this.volume = 0.5;
        this.isPlaying = false;
        this.isPaused = false;
        this.currentTime = 0;
        this.duration = 0;
        
        // Audio engines
        this.chiptunePlayer = null;
        
        // Multiple MIDI synthesizers
        this.tinySynth = null;
        this.spessaSynth = null;
        this.activeSynth = null; // Currently active synthesizer
        this.preferredSynth = 'auto'; // 'spessasynth', 'tinysynth', or 'auto'
        this.synthesizerReady = false;
        
        // Always use fallback mode (more compatible)
        this.useAudioWorklet = false;
        this.fallbackMode = true;
        this.initializationPhase = 'starting';
        
        this.uiController = null;
        this.progressInterval = null;
        this.currentPlayback = null;
        this.playbackType = null;
        this.pausedPosition = 0;
        
        // Error tracking
        this.errorCount = 0;
        this.maxErrors = 5;
        this.lastError = null;
        
        // Performance monitoring
        this.performanceMetrics = {
            initStartTime: performance.now(),
            firstPlayTime: 0
        };
        
        console.log('🎵 AudioEngine v2.5 initialized with SpessaSynth support');
    }
    
    setUIController(uiController) {
        this.uiController = uiController;
        this.updateSystemStatus('UI Controller connected');
    }
    
    async initialize() {
        try {
            this.initializationPhase = 'audioContext';
            this.updateSystemStatus('Initializing Web Audio Context...');
            
            // Initialize Audio Context
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) {
                throw new Error('Web Audio API not supported in this browser');
            }
            
            this.audioContext = new AudioContext();
            
            // Create gain node
            this.gainNode = this.audioContext.createGain();
            this.gainNode.connect(this.audioContext.destination);
            this.gainNode.gain.value = this.volume;
            
            // Add audio context state change listener
            this.audioContext.addEventListener('statechange', () => {
                this.updateSystemStatus(`Audio context: ${this.audioContext.state}`);
            });
            
            this.updateSystemStatus('Audio context initialized ✓');
            
            // Skip AudioWorklet - use direct Web Audio approach
            this.initializationPhase = 'engines';
            this.updateSystemStatus('Using Web Audio Direct Mode (no AudioWorklet)');
            
            // Initialize audio engines
            await this.initializeAudioEngines();
            
            // Setup user activation handlers
            this.setupUserActivation();
            
            // Final initialization
            this.initializationPhase = 'complete';
            this.updateSystemStatus('Audio engine ready (Web Audio Direct Mode) ✓');
            
            // Record initialization time
            this.performanceMetrics.initTime = performance.now() - this.performanceMetrics.initStartTime;
            console.log(`🚀 AudioEngine initialized in ${this.performanceMetrics.initTime.toFixed(2)}ms`);
            
            return true;
            
        } catch (error) {
            this.handleInitializationError(error);
            throw error;
        }
    }
    
    async initializeAudioEngines() {
        const engines = [];
        
        // Initialize ChiptuneJS
        try {
            this.updateSystemStatus('Initializing ChiptuneJS engine...');
            await this.initializeChiptuneJS();
            engines.push('ChiptuneJS');
        } catch (error) {
            console.warn('ChiptuneJS initialization failed:', error);
            this.updateSystemStatus('ChiptuneJS initialization failed: ' + error.message);
        }
        
        // Try SpessaSynth first (preferred for quality)
        let spessaReady = false;
        try {
            spessaReady = await this.initializeSpessaSynth();
            if (spessaReady) {
                engines.push('SpessaSynth');
            }
        } catch (error) {
            console.warn('SpessaSynth initialization failed:', error);
        }
        
        // Initialize TinySynth as fallback
        try {
            this.updateSystemStatus('Initializing TinySynth engine...');
            await this.initializeTinySynth();
            engines.push('TinySynth');
        } catch (error) {
            console.warn('TinySynth initialization failed:', error);
            this.updateSystemStatus('TinySynth initialization failed: ' + error.message);
        }
        
        // Set active synthesizer based on availability and preference
        this.selectBestSynthesizer();
        
        if (engines.length === 0) {
            throw new Error('No audio engines could be initialized');
        }
        
        this.updateSystemStatus(`Engines ready: ${engines.join(', ')} ✓`);
    }
    
    async initializeChiptuneJS() {
        this.updateSystemStatus('Checking for ChiptuneJS libraries...');
        
        // Wait for required libraries
        let attempts = 0;
        const maxAttempts = 50;
        
        while (attempts < maxAttempts) {
            const hasModule = typeof Module !== 'undefined';
            const hasChiptuneConfig = typeof ChiptuneJsConfig !== 'undefined';
            const hasChiptunePlayer = typeof ChiptuneJsPlayer !== 'undefined';
            
            if (hasModule && hasChiptuneConfig && hasChiptunePlayer) {
                // Check for WASM functions
                const hasWASMFunctions = Module._openmpt_module_create_from_memory && 
                                       Module._openmpt_module_read_float_stereo;
                
                if (hasWASMFunctions) {
                    break;
                }
            }
            
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        if (attempts >= maxAttempts) {
            throw new Error('ChiptuneJS libraries not loaded properly');
        }
        
        // Ensure libopenmpt has all required references
        if (!window.libopenmpt) {
            window.libopenmpt = Module;
            console.log('Created libopenmpt reference');
        }
        
        // Check for helper functions
        if (typeof UTF8ToString === 'undefined' || typeof writeAsciiToMemory === 'undefined') {
            console.warn('⚠️ Helper functions missing - tracker files may not work properly');
        }
        
        try {
            // Create ChiptuneJS player with proper configuration
            const config = new ChiptuneJsConfig(-1, 50, 1, this.audioContext);
            this.chiptunePlayer = new ChiptuneJsPlayer(config);
            
            // Setup event handlers
            this.chiptunePlayer.onEnded(() => {
                this.handleTrackEnd();
            });
            
            this.chiptunePlayer.onError((error) => {
                this.handlePlaybackError('ChiptuneJS error', error);
            });
            
            console.log('✅ ChiptuneJS player initialized with audio context');
            this.updateSystemStatus('ChiptuneJS ready ✓');
            
        } catch (error) {
            console.error('ChiptuneJS player creation failed:', error);
            this.chiptunePlayer = null;
            throw error;
        }
    }
    
    async initializeSpessaSynth() {
        this.updateSystemStatus('Initializing SpessaSynth engine...');
        
        try {
            // Check if SpessaSynthWrapper is available
            if (typeof SpessaSynthWrapper === 'undefined') {
                // Try to wait for it
                let attempts = 0;
                const maxAttempts = 30;
                
                while (typeof SpessaSynthWrapper === 'undefined' && attempts < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                    attempts++;
                }
                
                if (typeof SpessaSynthWrapper === 'undefined') {
                    throw new Error('SpessaSynthWrapper not loaded');
                }
            }
            
            this.spessaSynth = new SpessaSynthWrapper();
            await this.spessaSynth.initialize(this.audioContext);
            
            this.updateSystemStatus('SpessaSynth ready ✓');
            console.log('✅ SpessaSynth initialized successfully');
            return true;
            
        } catch (error) {
            console.warn('SpessaSynth initialization failed:', error);
            this.updateSystemStatus('SpessaSynth unavailable, will use TinySynth fallback');
            return false;
        }
    }
    
    async initializeTinySynth() {
        this.updateSystemStatus('Checking for TinySynth...');
        
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
            // Create TinySynth with proper settings
            this.tinySynth = new WebAudioTinySynth({
                quality: 1,      // High quality
                useReverb: 0,    // Disable reverb for better compatibility
                voices: 32       // More voices for complex MIDI
            });
            
            // TinySynth creates its own audio context and connects automatically
            if (this.tinySynth.getAudioContext) {
                const synthContext = this.tinySynth.getAudioContext();
                console.log('TinySynth audio context:', synthContext ? 'created' : 'not available');
            }
            
            console.log('✅ TinySynth initialized');
            this.updateSystemStatus('TinySynth ready ✓');
            
        } catch (error) {
            console.error('TinySynth initialization failed:', error);
            this.tinySynth = null;
            throw error;
        }
    }
    
    selectBestSynthesizer() {
        // Determine which synthesizer to use based on preference and availability
        if (this.preferredSynth === 'spessasynth' && this.spessaSynth && this.spessaSynth.isReady) {
            this.activeSynth = this.spessaSynth;
            this.synthesizerReady = true;
            this.updateSystemStatus('Using SpessaSynth for MIDI playback');
        } else if (this.preferredSynth === 'tinysynth' && this.tinySynth) {
            this.activeSynth = this.tinySynth;
            this.synthesizerReady = true;
            this.updateSystemStatus('Using TinySynth for MIDI playback');
        } else if (this.preferredSynth === 'auto') {
            // Auto mode: prefer SpessaSynth for quality
            if (this.spessaSynth && this.spessaSynth.isReady) {
                this.activeSynth = this.spessaSynth;
                this.synthesizerReady = true;
                this.updateSystemStatus('Using SpessaSynth for MIDI playback (auto)');
            } else if (this.tinySynth) {
                this.activeSynth = this.tinySynth;
                this.synthesizerReady = true;
                this.updateSystemStatus('Using TinySynth for MIDI playback (auto)');
            }
        }
        
        if (!this.activeSynth) {
            console.warn('No MIDI synthesizer available');
            this.synthesizerReady = false;
        }
    }
    
    setSynthesizer(synthType) {
        // synthType: 'spessasynth', 'tinysynth', or 'auto'
        this.preferredSynth = synthType;
        
        // Stop any current MIDI playback before switching
        if (this.currentPlayback?.type === 'midi') {
            this.stop();
        }
        
        this.selectBestSynthesizer();
        
        const synthName = this.activeSynth === this.spessaSynth ? 'SpessaSynth' : 
                         this.activeSynth === this.tinySynth ? 'TinySynth' : 'None';
        
        console.log(`Synthesizer switched to: ${synthName} (${synthType} mode)`);
    }
    
    async loadSoundFont(soundFontUrl) {
        if (!this.spessaSynth || !this.spessaSynth.isReady) {
            throw new Error('SpessaSynth not available for SoundFont loading');
        }
        
        try {
            this.updateSystemStatus(`Loading SoundFont: ${soundFontUrl}...`);
            
            const response = await fetch(soundFontUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch SoundFont: ${response.status}`);
            }
            
            const soundFontData = await response.arrayBuffer();
            await this.spessaSynth.loadSoundFont(soundFontData);
            
            // Switch to SpessaSynth after loading SoundFont
            this.activeSynth = this.spessaSynth;
            this.preferredSynth = 'spessasynth';
            this.synthesizerReady = true;
            this.synthesizer = this.spessaSynth; // For compatibility
            
            this.updateSystemStatus('SoundFont loaded successfully ✔');
            console.log('✅ SoundFont loaded, switched to SpessaSynth');
            return true;
            
        } catch (error) {
            this.updateSystemStatus(`SoundFont loading failed: ${error.message}`);
            console.error('SoundFont loading error:', error);
            throw error;
        }
    }
    
    setupUserActivation() {
        const activateAudio = async () => {
            if (this.audioContext && this.audioContext.state === 'suspended') {
                try {
                    await this.audioContext.resume();
                    this.updateSystemStatus('Audio context activated ✓');
                    console.log('🔊 Audio context activated');
                    
                    // Also activate TinySynth's context if it exists
                    if (this.tinySynth && this.tinySynth.getAudioContext) {
                        const synthContext = this.tinySynth.getAudioContext();
                        if (synthContext && synthContext.state === 'suspended') {
                            await synthContext.resume();
                            console.log('🔊 TinySynth context activated');
                        }
                    }
                    
                    // Activate SpessaSynth's context if it exists
                    if (this.spessaSynth && this.spessaSynth.audioContext) {
                        if (this.spessaSynth.audioContext.state === 'suspended') {
                            await this.spessaSynth.audioContext.resume();
                            console.log('🔊 SpessaSynth context activated');
                        }
                    }
                } catch (error) {
                    console.error('Failed to activate audio context:', error);
                    this.handleError('Audio activation failed', error);
                }
            }
        };
        
        // Setup activation on various user interactions
        ['click', 'touchstart', 'keydown'].forEach(event => {
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
            this.updateSystemStatus(`Loading ${trackData.filename}...`);
            
            // Record first play time
            if (this.performanceMetrics.firstPlayTime === 0) {
                this.performanceMetrics.firstPlayTime = performance.now();
            }
            
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
            
            // Update UI state
            if (this.uiController) {
                this.uiController.updatePlaybackState(true, false);
            }
            
            this.updateSystemStatus(`Playing: ${trackData.filename} ♪`);
            
        } catch (error) {
            this.handlePlaybackError('Playback failed', error);
            throw error;
        }
    }
    
    async playTrackerModule(url, trackData) {
        if (!this.chiptunePlayer) {
            throw new Error('ChiptuneJS player not available');
        }
        
        try {
            this.updateSystemStatus('Loading tracker module...');
            
            // Use ChiptuneJS's built-in loading mechanism
            await new Promise((resolve, reject) => {
                this.chiptunePlayer.load(url, (buffer) => {
                    if (buffer) {
                        try {
                            this.chiptunePlayer.play(buffer);
                            this.currentPlayback = { 
                                type: 'chiptune', 
                                player: this.chiptunePlayer 
                            };
                            
                            // Start progress monitoring
                            this.startProgressMonitoring();
                            
                            this.updateSystemStatus('ChiptuneJS playback started ✔');
                            resolve();
                        } catch (playError) {
                            reject(playError);
                        }
                    } else {
                        reject(new Error('Failed to load tracker module'));
                    }
                });
            });
            
        } catch (error) {
            throw new Error(`Tracker module playback failed: ${error.message}`);
        }
    }
    
    async playMidiFile(url, trackData) {
        if (!this.activeSynth || !this.synthesizerReady) {
            throw new Error('No MIDI synthesizer available');
        }
        
        try {
            this.updateSystemStatus('Loading MIDI file...');
            
            const synthName = this.activeSynth === this.spessaSynth ? 'SpessaSynth' : 'TinySynth';
            
            if (this.activeSynth === this.spessaSynth) {
                // Use SpessaSynth
                await this.spessaSynth.loadMIDIFromUrl(url);
                this.spessaSynth.play();
                
                this.currentPlayback = { 
                    type: 'midi', 
                    player: this.spessaSynth,
                    engine: 'spessasynth'
                };
                
                this.duration = this.spessaSynth.getTotalTime();
                
            } else if (this.activeSynth === this.tinySynth) {
                // Use TinySynth
                await new Promise((resolve, reject) => {
                    // Use loadMIDIUrl which properly handles the MIDI loading
                    this.tinySynth.loadMIDIUrl(url);
                    
                    // Wait a moment for loading
                    setTimeout(() => {
                        try {
                            this.tinySynth.playMIDI();
                            this.currentPlayback = { 
                                type: 'midi', 
                                player: this.tinySynth,
                                engine: 'tinysynth'
                            };
                            
                            // Get duration if available
                            if (this.tinySynth.getTotalTime) {
                                this.duration = this.tinySynth.getTotalTime();
                            }
                            
                            resolve();
                        } catch (playError) {
                            reject(playError);
                        }
                    }, 500); // Give it time to load
                });
            } else {
                throw new Error('No active synthesizer available');
            }
            
            // Start progress monitoring
            this.startProgressMonitoring();
            
            this.updateSystemStatus(`${synthName} MIDI playback started ✔`);
            
        } catch (error) {
            throw new Error(`MIDI playback failed: ${error.message}`);
        }
    }
    
    pause() {
        if (!this.isPlaying || this.isPaused) return;
        
        try {
            this.isPaused = true;
            
            if (this.currentPlayback?.type === 'chiptune' && this.chiptunePlayer) {
                this.chiptunePlayer.togglePause();
            } else if (this.currentPlayback?.type === 'midi') {
                if (this.currentPlayback.engine === 'spessasynth' && this.spessaSynth) {
                    this.spessaSynth.pause();
                    this.pausedPosition = this.spessaSynth.getPlayTime();
                } else if (this.currentPlayback.engine === 'tinysynth' && this.tinySynth) {
                    // TinySynth doesn't have pause, so we stop and track position
                    if (this.tinySynth.getPlayTime) {
                        this.pausedPosition = this.tinySynth.getPlayTime();
                    }
                    this.tinySynth.stopMIDI();
                }
            }
            
            if (this.uiController) {
                this.uiController.updatePlaybackState(true, true);
            }
            
            this.updateSystemStatus('Paused ⏸');
            
        } catch (error) {
            this.handlePlaybackError('Pause failed', error);
        }
    }
    
    resume() {
        if (!this.isPaused) return;
        
        try {
            this.isPaused = false;
            
            if (this.currentPlayback?.type === 'chiptune' && this.chiptunePlayer) {
                this.chiptunePlayer.togglePause();
            } else if (this.currentPlayback?.type === 'midi') {
                if (this.currentPlayback.engine === 'spessasynth' && this.spessaSynth) {
                    this.spessaSynth.play();
                    if (this.pausedPosition && this.spessaSynth.setPlayTime) {
                        this.spessaSynth.setPlayTime(this.pausedPosition);
                    }
                } else if (this.currentPlayback.engine === 'tinysynth' && this.tinySynth) {
                    // Resume MIDI from saved position
                    this.tinySynth.playMIDI();
                    if (this.pausedPosition && this.tinySynth.setPlayTime) {
                        this.tinySynth.setPlayTime(this.pausedPosition);
                    }
                }
            }
            
            if (this.uiController) {
                this.uiController.updatePlaybackState(true, false);
            }
            
            this.updateSystemStatus('Resumed ♪');
            
        } catch (error) {
            this.handlePlaybackError('Resume failed', error);
        }
    }
    
    stop() {
        try {
            this.isPlaying = false;
            this.isPaused = false;
            this.currentTime = 0;
            this.pausedPosition = 0;
            
            if (this.currentPlayback?.type === 'chiptune' && this.chiptunePlayer) {
                this.chiptunePlayer.stop();
            } else if (this.currentPlayback?.type === 'midi') {
                if (this.currentPlayback.engine === 'spessasynth' && this.spessaSynth) {
                    this.spessaSynth.stop();
                } else if (this.currentPlayback.engine === 'tinysynth' && this.tinySynth) {
                    this.tinySynth.stopMIDI();
                    // Send all notes off
                    for (let ch = 0; ch < 16; ch++) {
                        this.tinySynth.send([0xB0 | ch, 123, 0], 0);
                    }
                }
            }
            
            this.currentPlayback = null;
            this.playbackType = null;
            
            this.stopProgressMonitoring();
            
            if (this.uiController) {
                this.uiController.updatePlaybackState(false, false);
                this.uiController.updateProgress(0, 0);
            }
            
            this.updateSystemStatus('Stopped ⏹');
            
        } catch (error) {
            this.handlePlaybackError('Stop failed', error);
        }
    }
    
    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
        
        if (this.gainNode) {
            this.gainNode.gain.value = this.volume;
        }
        
        // Set volume for synthesizers
        if (this.tinySynth && this.tinySynth.setMasterVol) {
            this.tinySynth.setMasterVol(Math.floor(this.volume * 127));
        }
        
        if (this.spessaSynth) {
            this.spessaSynth.setVolume(this.volume);
        }
        
        if (this.uiController) {
            this.uiController.updateVolume(this.volume);
        }
    }
    
    startProgressMonitoring() {
        this.stopProgressMonitoring();
        
        this.progressInterval = setInterval(() => {
            try {
                let currentTime = 0;
                let duration = 0;
                
                if (this.currentPlayback?.type === 'chiptune' && this.chiptunePlayer) {
                    // ChiptuneJS progress methods
                    if (this.chiptunePlayer.getCurrentTime) {
                        currentTime = this.chiptunePlayer.getCurrentTime();
                    }
                    if (this.chiptunePlayer.duration) {
                        duration = this.chiptunePlayer.duration();
                    }
                } else if (this.currentPlayback?.type === 'midi') {
                    if (this.currentPlayback.engine === 'spessasynth' && this.spessaSynth) {
                        currentTime = this.spessaSynth.getPlayTime();
                        duration = this.spessaSynth.getTotalTime();
                    } else if (this.currentPlayback.engine === 'tinysynth' && this.tinySynth) {
                        // TinySynth progress methods
                        if (this.tinySynth.getPlayTime) {
                            currentTime = this.tinySynth.getPlayTime();
                        }
                        if (this.tinySynth.getTotalTime) {
                            duration = this.tinySynth.getTotalTime();
                        }
                    }
                }
                
                this.currentTime = currentTime;
                this.duration = duration;
                
                if (this.uiController) {
                    this.uiController.updateProgress(this.currentTime, this.duration);
                }
                
                // Check if track ended (with some buffer)
                if (duration > 0 && currentTime >= duration - 0.1) {
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
        this.stop();
        this.updateSystemStatus('Track ended');
        
        if (this.uiController) {
            this.uiController.handleTrackEnd();
        }
    }
    
    handlePlaybackError(context, error) {
        this.errorCount++;
        this.lastError = { context, error, time: Date.now() };
        
        console.error(`${context}:`, error);
        this.updateSystemStatus(`ERROR: ${context} - ${error.message}`);
        
        if (this.uiController) {
            this.uiController.showError(`${context}: ${error.message}`);
        }
        
        // Stop playback on error
        this.stop();
    }
    
    handleInitializationError(error) {
        this.lastError = { context: 'initialization', error, phase: this.initializationPhase };
        
        console.error(`Initialization failed at ${this.initializationPhase}:`, error);
        this.updateSystemStatus(`Initialization failed: ${error.message}`);
        
        if (this.uiController) {
            this.uiController.showError(`Initialization failed: ${error.message}`);
        }
    }
    
    handleError(context, error) {
        this.handlePlaybackError(context, error);
    }
    
    updateStatus(message) {
        this.updateSystemStatus(message);
    }
    
    updateSystemStatus(message) {
        console.log('🎵', message);
        
        if (this.uiController) {
            this.uiController.updateSystemStatus(message);
        }
    }
    
    // Compatibility methods
    updateAudioContextStatus(status) {
        if (this.uiController && this.uiController.updateAudioContextStatus) {
            this.uiController.updateAudioContextStatus(status);
        }
    }
    
    // Public API methods
    getPerformanceMetrics() {
        return { ...this.performanceMetrics };
    }
    
    getStatus() {
        return {
            isPlaying: this.isPlaying,
            isPaused: this.isPaused,
            currentTime: this.currentTime,
            duration: this.duration,
            volume: this.volume,
            useAudioWorklet: false,
            fallbackMode: true,
            synthesizerReady: this.synthesizerReady,
            errorCount: this.errorCount,
            lastError: this.lastError,
            playbackType: this.playbackType,
            hasChiptunePlayer: !!this.chiptunePlayer,
            hasSpessaSynth: !!this.spessaSynth,
            spessaSynthReady: this.spessaSynth?.isReady,
            hasTinySynth: !!this.tinySynth,
            activeSynth: this.activeSynth === this.spessaSynth ? 'SpessaSynth' : 
                        this.activeSynth === this.tinySynth ? 'TinySynth' : 'None',
            preferredSynth: this.preferredSynth
        };
    }
    
    getSynthesizerInfo() {
        const info = {
            available: [],
            active: null,
            preferred: this.preferredSynth
        };
        
        if (this.spessaSynth && this.spessaSynth.isReady) {
            info.available.push({
                name: 'SpessaSynth',
                ready: true,
                features: ['SoundFont support', 'High quality', '64 voices', 'Full GM/GS']
            });
        }
        
        if (this.tinySynth) {
            info.available.push({
                name: 'TinySynth',
                ready: true,
                features: ['Lightweight', 'Built-in sounds', 'Low CPU']
            });
        }
        
        if (this.activeSynth === this.spessaSynth) {
            info.active = 'SpessaSynth';
        } else if (this.activeSynth === this.tinySynth) {
            info.active = 'TinySynth';
        }
        
        return info;
    }
    
    // Diagnostic methods
    async runDiagnostics() {
        const diagnostics = {
            audioContext: {
                state: this.audioContext?.state,
                sampleRate: this.audioContext?.sampleRate,
                baseLatency: this.audioContext?.baseLatency,
                outputLatency: this.audioContext?.outputLatency
            },
            audioWorklet: {
                supported: !!(this.audioContext?.audioWorklet),
                active: false,
                nodeConnected: false
            },
            engines: {
                chiptunePlayer: !!this.chiptunePlayer,
                spessaSynth: !!this.spessaSynth,
                spessaSynthReady: this.spessaSynth?.isReady,
                tinySynth: !!this.tinySynth,
                synthesizerReady: this.synthesizerReady,
                activeSynth: this.activeSynth === this.spessaSynth ? 'SpessaSynth' : 
                            this.activeSynth === this.tinySynth ? 'TinySynth' : 'None'
            },
            libraries: {
                Module: typeof Module !== 'undefined',
                libopenmpt: typeof libopenmpt !== 'undefined',
                ChiptuneJsConfig: typeof ChiptuneJsConfig !== 'undefined',
                ChiptuneJsPlayer: typeof ChiptuneJsPlayer !== 'undefined',
                SpessaSynth: typeof SpessaSynth !== 'undefined' || typeof SpessaSynthWrapper !== 'undefined',
                WebAudioTinySynth: typeof WebAudioTinySynth !== 'undefined',
                UTF8ToString: typeof UTF8ToString !== 'undefined',
                writeAsciiToMemory: typeof writeAsciiToMemory !== 'undefined'
            },
            performance: this.performanceMetrics,
            errors: {
                count: this.errorCount,
                lastError: this.lastError
            }
        };
        
        console.log('🔍 Audio Engine Diagnostics:', diagnostics);
        return diagnostics;
    }
}
