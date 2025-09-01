// Enhanced Fallback AudioEngine with SpessaSynth and TinySynth support
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
        this.chiptunePlayer = null;
        
        // Multiple MIDI synthesizers
        this.tinySynth = null;
        this.spessaSynth = null;
        this.activeSynth = null; // Currently active synthesizer
        this.preferredSynth = 'auto'; // 'spessasynth', 'tinysynth', or 'auto'
        this.synthesizerReady = false;
        
        // Playback state
        this.currentPlayback = null;
        this.playbackType = null;
        this.progressInterval = null;
        this.pausedPosition = 0;
        
        // UI Controller
        this.uiController = null;
        
        // ScriptProcessor for monitoring (if needed)
        this.monitorNode = null;
        
        console.log('🎵 FallbackAudioEngine v2.2 initialized with SpessaSynth support');
    }
    
    setUIController(uiController) {
        this.uiController = uiController;
    }
    
    async initialize() {
        try {
            this.updateStatus('Initializing fallback audio engine...');
            
            // Initialize Web Audio Context
            await this.initializeAudioContext();
            
            // Initialize audio engines
            await this.initializeAudioEngines();
            
            // Setup user activation handlers
            this.setupUserActivation();
            
            this.updateStatus('Fallback audio engine ready ✔');
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
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) {
                throw new Error('Web Audio API not supported');
            }
            
            this.audioContext = new AudioContext();
            
            // Create gain node
            this.gainNode = this.audioContext.createGain();
            this.gainNode.connect(this.audioContext.destination);
            this.gainNode.gain.value = this.volume;
            
            // Add state change listener
            this.audioContext.addEventListener('statechange', () => {
                this.updateStatus(`Audio context: ${this.audioContext.state}`);
            });
            
            this.updateStatus(`Audio context initialized (${this.audioContext.state}) ✔`);
            
        } catch (error) {
            console.error('AudioContext initialization failed:', error);
            throw new Error(`AudioContext initialization failed: ${error.message}`);
        }
    }
    
    async initializeAudioEngines() {
        const engines = [];
        
        // Initialize ChiptuneJS with proper connection
        try {
            this.updateStatus('Initializing ChiptuneJS engine...');
            await this.initializeChiptuneJS();
            engines.push('ChiptuneJS');
        } catch (error) {
            console.warn('ChiptuneJS initialization failed:', error);
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
            this.updateStatus('Initializing TinySynth engine...');
            await this.initializeTinySynth();
            engines.push('TinySynth');
        } catch (error) {
            console.warn('TinySynth initialization failed:', error);
        }
        
        // Set active synthesizer based on availability and preference
        this.selectBestSynthesizer();
        
        if (engines.length === 0) {
            throw new Error('No audio engines could be initialized');
        }
        
        this.updateStatus(`Audio engines ready: ${engines.join(', ')} ✔`);
    }
    
    async initializeChiptuneJS() {
        // Wait for required libraries
        let attempts = 0;
        const maxAttempts = 50;
        
        while (attempts < maxAttempts) {
            // Check for all required components
            const hasModule = typeof Module !== 'undefined';
            const hasChiptuneConfig = typeof ChiptuneJsConfig !== 'undefined';
            const hasChiptunePlayer = typeof ChiptuneJsPlayer !== 'undefined';
            const hasLibOpenMPT = typeof libopenmpt !== 'undefined';
            
            if (hasModule && hasChiptuneConfig && hasChiptunePlayer) {
                // Also check for WASM functions
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
        }
        
        // Create ChiptuneJS player with proper configuration
        // Pass -1 for repeatCount (infinite), default stereo separation, and our audio context
        const config = new ChiptuneJsConfig(-1, 50, 1, this.audioContext);
        this.chiptunePlayer = new ChiptuneJsPlayer(config);
        
        console.log('✅ ChiptuneJS player initialized with audio context');
        this.updateStatus('ChiptuneJS ready ✔');
    }
    
    async initializeSpessaSynth() {
        this.updateStatus('Initializing SpessaSynth engine...');
        
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
            
            this.updateStatus('SpessaSynth ready ✔');
            console.log('✅ SpessaSynth initialized successfully');
            return true;
            
        } catch (error) {
            console.warn('SpessaSynth initialization failed:', error);
            this.updateStatus('SpessaSynth unavailable, will use TinySynth fallback');
            return false;
        }
    }
    
    async initializeTinySynth() {
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
        
        // Create TinySynth with proper Web Audio connection
        this.tinySynth = new WebAudioTinySynth({
            quality: 1,      // High quality
            useReverb: 0,    // Disable reverb for better performance
            voices: 32       // More voices for complex MIDI files
        });
        
        // CRITICAL: Connect TinySynth to our audio graph
        // TinySynth creates its own audio context, we need to connect it
        if (this.tinySynth.getAudioContext) {
            const synthContext = this.tinySynth.getAudioContext();
            console.log('TinySynth has audio context:', synthContext);
            
            // TinySynth automatically connects to its context's destination
            // No additional connection needed
        }
        
        console.log('✅ TinySynth initialized');
        this.updateStatus('TinySynth ready ✔');
    }
    
    selectBestSynthesizer() {
        // Determine which synthesizer to use based on preference and availability
        if (this.preferredSynth === 'spessasynth' && this.spessaSynth && this.spessaSynth.isReady) {
            this.activeSynth = this.spessaSynth;
            this.synthesizerReady = true;
            this.updateStatus('Using SpessaSynth for MIDI playback');
        } else if (this.preferredSynth === 'tinysynth' && this.tinySynth) {
            this.activeSynth = this.tinySynth;
            this.synthesizerReady = true;
            this.updateStatus('Using TinySynth for MIDI playback');
        } else if (this.preferredSynth === 'auto') {
            // Auto mode: prefer SpessaSynth for quality
            if (this.spessaSynth && this.spessaSynth.isReady) {
                this.activeSynth = this.spessaSynth;
                this.synthesizerReady = true;
                this.updateStatus('Using SpessaSynth for MIDI playback (auto)');
            } else if (this.tinySynth) {
                this.activeSynth = this.tinySynth;
                this.synthesizerReady = true;
                this.updateStatus('Using TinySynth for MIDI playback (auto)');
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
            this.updateStatus(`Loading SoundFont: ${soundFontUrl}...`);
            
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
            
            this.updateStatus('SoundFont loaded successfully ✔');
            console.log('✅ SoundFont loaded, switched to SpessaSynth');
            return true;
            
        } catch (error) {
            this.updateStatus(`SoundFont loading failed: ${error.message}`);
            console.error('SoundFont loading error:', error);
            throw error;
        }
    }
    
    setupUserActivation() {
        const activateAudio = async () => {
            if (this.audioContext && this.audioContext.state === 'suspended') {
                try {
                    await this.audioContext.resume();
                    this.updateStatus('Audio context activated ✔');
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
            this.updateStatus(`Loading ${trackData.filename}...`);
            
            // Ensure audio contexts are ready
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
            
            this.updateStatus(`Playing: ${trackData.filename} ♪`);
            
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
            this.updateStatus('Downloading tracker module...');
            
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
                            
                            // Set up end handler
                            this.chiptunePlayer.onEnded(() => {
                                this.handleTrackEnd();
                            });
                            
                            this.updateStatus('ChiptuneJS playback started ✔');
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
            this.updateStatus('Loading MIDI file...');
            
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
                            
                            this.updateStatus(`${synthName} MIDI playback started ✔`);
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
            
            this.updateStatus(`${synthName} MIDI playback started ✔`);
            
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
            
            this.updateStatus('Paused ⏸');
            
        } catch (error) {
            console.error('Pause error:', error);
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
            
            this.updateStatus('Resumed ♪');
            
        } catch (error) {
            console.error('Resume error:', error);
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
            
            this.updateStatus('Stopped ⏹');
            
        } catch (error) {
            console.error('Stop error:', error);
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
        
        this.stop();
    }
    
    updateStatus(message) {
        console.log('🎵 [Fallback]', message);
        
        if (this.uiController) {
            this.uiController.updateSystemStatus(message);
        }
    }
    
    // Compatibility properties
    get fallbackMode() { return true; }
    get useAudioWorklet() { return false; }
    
    // Public API methods
    getStatus() {
        return {
            isPlaying: this.isPlaying,
            isPaused: this.isPaused,
            currentTime: this.currentTime,
            duration: this.duration,
            volume: this.volume,
            fallbackMode: true,
            useAudioWorklet: false,
            synthesizerReady: this.synthesizerReady,
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
                features: ['SoundFont support', 'High quality', '64 voices']
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
}
