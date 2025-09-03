// Enhanced AudioEngine with SpessaSynth, TinySynth, and ChiptuneJS support
class EnhancedAudioEngine {
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
        this.spessaSynth = null;
        this.tinySynth = null;
        this.synthesizerReady = false;
        
        // SpessaSynth specific
        this.currentSynthEngine = 'auto'; // 'spessasynth', 'tinysynth', 'auto'
        this.currentSoundFont = null;
        this.loadedSoundFonts = [];
        this.activeVoices = 0;
        
        // Playback state
        this.currentPlayback = null;
        this.playbackType = null;
        this.progressInterval = null;
        this.pausedPosition = 0;
        
        // UI Controller
        this.uiController = null;
        
        // Error tracking
        this.errorCount = 0;
        this.maxErrors = 5;
        this.lastError = null;
        
        console.log('🎵 EnhancedAudioEngine v2.5.1 initialized (SpessaSynth + TinySynth + ChiptuneJS)');
    }
    
    setUIController(uiController) {
        this.uiController = uiController;
        this.updateStatus('UI Controller connected');
    }
    
    async initialize() {
        try {
            this.updateStatus('Initializing Enhanced Audio Engine...');
            
            // Initialize Web Audio Context
            await this.initializeAudioContext();
            
            // Initialize audio engines
            await this.initializeAudioEngines();
            
            // Setup user activation handlers
            this.setupUserActivation();
            
            this.updateStatus('Enhanced Audio Engine ready (SpessaSynth + fallbacks) ✓');
            console.log('✅ EnhancedAudioEngine initialized successfully');
            
            return true;
            
        } catch (error) {
            this.handleInitializationError(error);
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
        
        // Initialize ChiptuneJS first
        try {
            this.updateStatus('Initializing ChiptuneJS engine...');
            await this.initializeChiptuneJS();
            engines.push('ChiptuneJS');
        } catch (error) {
            console.warn('ChiptuneJS initialization failed:', error);
        }
        
        // Initialize SpessaSynth (primary MIDI engine)
        try {
            this.updateStatus('Initializing SpessaSynth engine...');
            await this.initializeSpessaSynth();
            engines.push('SpessaSynth');
            this.currentSynthEngine = 'spessasynth';
        } catch (error) {
            console.warn('SpessaSynth initialization failed:', error);
            
            // Fall back to TinySynth
            try {
                this.updateStatus('Falling back to TinySynth engine...');
                await this.initializeTinySynth();
                engines.push('TinySynth');
                this.currentSynthEngine = 'tinysynth';
            } catch (fallbackError) {
                console.warn('TinySynth fallback also failed:', fallbackError);
                this.currentSynthEngine = 'none';
            }
        }
        
        if (engines.length === 0) {
            throw new Error('No audio engines could be initialized');
        }
        
        this.synthesizerReady = engines.includes('SpessaSynth') || engines.includes('TinySynth');
        this.updateStatus(`Audio engines ready: ${engines.join(', ')} ✓`);
    }
    
    async initializeChiptuneJS() {
        // Wait for required libraries (same as before)
        let attempts = 0;
        const maxAttempts = 50;
        
        while (attempts < maxAttempts) {
            const hasModule = typeof Module !== 'undefined';
            const hasChiptuneConfig = typeof ChiptuneJsConfig !== 'undefined';
            const hasChiptunePlayer = typeof ChiptuneJsPlayer !== 'undefined';
            
            if (hasModule && hasChiptuneConfig && hasChiptunePlayer) {
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
        
        // Ensure libopenmpt reference
        if (!window.libopenmpt) {
            window.libopenmpt = Module;
        }
        
        // Create ChiptuneJS player
        const config = new ChiptuneJsConfig(-1, 50, 1, this.audioContext);
        this.chiptunePlayer = new ChiptuneJsPlayer(config);
        
        console.log('✅ ChiptuneJS player initialized');
        this.updateStatus('ChiptuneJS ready ✓');
    }
    
    async initializeSpessaSynth() {
        // Check if SpessaSynth is available
        if (typeof window.SpessaSynth === 'undefined' && typeof SpessaSynthLoader === 'undefined') {
            throw new Error('SpessaSynth library not found');
        }
        
        try {
            // Initialize SpessaSynth with our audio context
            if (typeof window.SpessaSynth !== 'undefined') {
                this.spessaSynth = new window.SpessaSynth(this.audioContext);
            } else if (typeof SpessaSynthLoader !== 'undefined') {
                // Alternative initialization method
                this.spessaSynth = await SpessaSynthLoader.loadSynth(this.audioContext);
            }
            
            // Connect to our gain node
            if (this.spessaSynth && this.spessaSynth.connect) {
                this.spessaSynth.connect(this.gainNode);
            }
            
            // Load default soundfont if available
            await this.loadDefaultSoundFont();
            
            // Setup event listeners
            if (this.spessaSynth && this.spessaSynth.eventHandler) {
                this.spessaSynth.eventHandler.addEvent('noteOn', () => {
                    this.updateActiveVoices();
                });
                
                this.spessaSynth.eventHandler.addEvent('noteOff', () => {
                    this.updateActiveVoices();
                });
            }
            
            console.log('✅ SpessaSynth initialized');
            this.updateStatus('SpessaSynth ready ✓');
            
        } catch (error) {
            console.error('SpessaSynth initialization failed:', error);
            throw error;
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
        
        try {
            // Create TinySynth
            this.tinySynth = new WebAudioTinySynth({
                quality: 1,
                useReverb: 0,
                voices: 32
            });
            
            console.log('✅ TinySynth initialized');
            this.updateStatus('TinySynth ready ✓');
            
        } catch (error) {
            console.error('TinySynth initialization failed:', error);
            throw error;
        }
    }
    
    async loadDefaultSoundFont() {
        try {
            const response = await fetch('/soundfonts/default.sf2');
            if (response.ok) {
                const soundFontData = await response.arrayBuffer();
                
                if (this.spessaSynth && this.spessaSynth.loadSoundFont) {
                    await this.spessaSynth.loadSoundFont(soundFontData);
                    this.currentSoundFont = 'default.sf2';
                    this.updateStatus('Default SoundFont loaded ✓');
                    console.log('✅ Default SoundFont loaded');
                }
            }
        } catch (error) {
            console.warn('Default SoundFont not available:', error.message);
            this.currentSoundFont = 'Built-in';
        }
    }
    
    setupUserActivation() {
        const activateAudio = async () => {
            if (this.audioContext && this.audioContext.state === 'suspended') {
                try {
                    await this.audioContext.resume();
                    this.updateStatus('Audio context activated ✓');
                    console.log('🔊 Audio context activated');
                } catch (error) {
                    console.error('Failed to activate audio context:', error);
                }
            }
        };
        
        ['click', 'touchstart', 'keydown'].forEach(event => {
            document.addEventListener(event, activateAudio, { once: true });
        });
    }
    
    async playTrack(trackData) {
        if (!trackData) {
            throw new Error('No track data provided');
        }
        
        try {
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
            
            // Update UI state
            if (this.uiController) {
                this.uiController.updatePlaybackState(true, false);
                this.uiController.updateSynthInfo();
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
            this.updateStatus('Loading tracker module...');
            
            await new Promise((resolve, reject) => {
                this.chiptunePlayer.load(url, (buffer) => {
                    if (buffer) {
                        try {
                            this.chiptunePlayer.play(buffer);
                            this.currentPlayback = { 
                                type: 'chiptune', 
                                player: this.chiptunePlayer 
                            };
                            
                            this.startProgressMonitoring();
                            this.updateStatus('Tracker module playback started ✔');
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
        const preferredEngine = this.currentSynthEngine === 'auto' ? 
            (this.spessaSynth ? 'spessasynth' : 'tinysynth') : this.currentSynthEngine;
        
        if (preferredEngine === 'spessasynth' && this.spessaSynth) {
            await this.playMidiWithSpessaSynth(url, trackData);
        } else if (preferredEngine === 'tinysynth' && this.tinySynth) {
            await this.playMidiWithTinySynth(url, trackData);
        } else {
            throw new Error('No MIDI synthesizer available');
        }
    }
    
    async playMidiWithSpessaSynth(url, trackData) {
        if (!this.spessaSynth) {
            throw new Error('SpessaSynth not available');
        }
        
        try {
            this.updateStatus('Loading MIDI file with SpessaSynth...');
            
            // Load MIDI file
            const response = await fetch(url);
            const midiData = await response.arrayBuffer();
            
            // Parse and play with SpessaSynth
            await this.spessaSynth.loadMIDI(new Uint8Array(midiData));
            this.spessaSynth.play();
            
            this.currentPlayback = { 
                type: 'midi-spessa', 
                player: this.spessaSynth 
            };
            
            // Get duration if available
            if (this.spessaSynth.getDuration) {
                this.duration = this.spessaSynth.getDuration();
            }
            
            this.startProgressMonitoring();
            this.updateStatus('SpessaSynth MIDI playback started ✔');
            
        } catch (error) {
            throw new Error(`SpessaSynth MIDI playback failed: ${error.message}`);
        }
    }
    
    async playMidiWithTinySynth(url, trackData) {
        if (!this.tinySynth) {
            throw new Error('TinySynth not available');
        }
        
        try {
            this.updateStatus('Loading MIDI file with TinySynth...');
            
            this.tinySynth.loadMIDIUrl(url);
            
            setTimeout(() => {
                this.tinySynth.playMIDI();
                this.currentPlayback = { 
                    type: 'midi-tiny', 
                    player: this.tinySynth 
                };
                
                if (this.tinySynth.getTotalTime) {
                    this.duration = this.tinySynth.getTotalTime();
                }
                
                this.startProgressMonitoring();
                this.updateStatus('TinySynth MIDI playback started ✔');
            }, 500);
            
        } catch (error) {
            throw new Error(`TinySynth MIDI playback failed: ${error.message}`);
        }
    }
    
    pause() {
        if (!this.isPlaying || this.isPaused) return;
        
        try {
            this.isPaused = true;
            
            if (this.currentPlayback?.type === 'chiptune' && this.chiptunePlayer) {
                this.chiptunePlayer.togglePause();
            } else if (this.currentPlayback?.type === 'midi-spessa' && this.spessaSynth) {
                this.spessaSynth.pause();
            } else if (this.currentPlayback?.type === 'midi-tiny' && this.tinySynth) {
                if (this.tinySynth.getPlayTime) {
                    this.pausedPosition = this.tinySynth.getPlayTime();
                }
                this.tinySynth.stopMIDI();
            }
            
            if (this.uiController) {
                this.uiController.updatePlaybackState(true, true);
            }
            
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
                this.chiptunePlayer.togglePause();
            } else if (this.currentPlayback?.type === 'midi-spessa' && this.spessaSynth) {
                this.spessaSynth.resume();
            } else if (this.currentPlayback?.type === 'midi-tiny' && this.tinySynth) {
                this.tinySynth.playMIDI();
                if (this.pausedPosition && this.tinySynth.setPlayTime) {
                    this.tinySynth.setPlayTime(this.pausedPosition);
                }
            }
            
            if (this.uiController) {
                this.uiController.updatePlaybackState(true, false);
            }
            
            this.updateStatus('Resumed ♪');
            
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
            this.activeVoices = 0;
            
            if (this.currentPlayback?.type === 'chiptune' && this.chiptunePlayer) {
                this.chiptunePlayer.stop();
            } else if (this.currentPlayback?.type === 'midi-spessa' && this.spessaSynth) {
                this.spessaSynth.stop();
                this.spessaSynth.allNotesOff();
            } else if (this.currentPlayback?.type === 'midi-tiny' && this.tinySynth) {
                this.tinySynth.stopMIDI();
                for (let ch = 0; ch < 16; ch++) {
                    this.tinySynth.send([0xB0 | ch, 123, 0], 0);
                }
            }
            
            this.currentPlayback = null;
            this.playbackType = null;
            
            this.stopProgressMonitoring();
            
            if (this.uiController) {
                this.uiController.updatePlaybackState(false, false);
                this.uiController.updateProgress(0, 0);
                this.uiController.updateSynthInfo();
            }
            
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
        
        // SpessaSynth volume control
        if (this.spessaSynth && this.spessaSynth.setMasterVolume) {
            this.spessaSynth.setMasterVolume(this.volume);
        }
        
        // TinySynth volume control
        if (this.tinySynth && this.tinySynth.setMasterVol) {
            this.tinySynth.setMasterVol(Math.floor(this.volume * 127));
        }
        
        if (this.uiController) {
            this.uiController.updateVolume(this.volume);
        }
    }
    
    async switchSynthEngine(engine) {
        if (engine === this.currentSynthEngine) return;
        
        const wasPlaying = this.isPlaying;
        const currentTrack = this.currentPlayback;
        
        if (wasPlaying) {
            this.stop();
        }
        
        this.currentSynthEngine = engine;
        
        if (this.uiController) {
            this.uiController.updateSynthInfo();
        }
        
        this.updateStatus(`Switched to ${engine} engine`);
    }
    
    async loadSoundFont(soundFontData, name) {
        if (!this.spessaSynth) {
            throw new Error('SpessaSynth not available for SoundFont loading');
        }
        
        try {
            await this.spessaSynth.loadSoundFont(soundFontData);
            this.currentSoundFont = name;
            
            if (!this.loadedSoundFonts.includes(name)) {
                this.loadedSoundFonts.push(name);
            }
            
            if (this.uiController) {
                this.uiController.updateSynthInfo();
            }
            
            this.updateStatus(`SoundFont "${name}" loaded ✓`);
            
        } catch (error) {
            throw new Error(`SoundFont loading failed: ${error.message}`);
        }
    }
    
    updateActiveVoices() {
        if (this.spessaSynth && this.spessaSynth.getActiveVoiceCount) {
            this.activeVoices = this.spessaSynth.getActiveVoiceCount();
        } else {
            this.activeVoices = 0;
        }
        
        if (this.uiController) {
            this.uiController.updateSynthInfo();
        }
    }
    
    startProgressMonitoring() {
        this.stopProgressMonitoring();
        
        this.progressInterval = setInterval(() => {
            try {
                let currentTime = 0;
                let duration = 0;
                
                if (this.currentPlayback?.type === 'chiptune' && this.chiptunePlayer) {
                    if (this.chiptunePlayer.getCurrentTime) {
                        currentTime = this.chiptunePlayer.getCurrentTime();
                    }
                    if (this.chiptunePlayer.duration) {
                        duration = this.chiptunePlayer.duration();
                    }
                } else if (this.currentPlayback?.type === 'midi-spessa' && this.spessaSynth) {
                    if (this.spessaSynth.getCurrentTime) {
                        currentTime = this.spessaSynth.getCurrentTime();
                    }
                    if (this.spessaSynth.getDuration) {
                        duration = this.spessaSynth.getDuration();
                    }
                } else if (this.currentPlayback?.type === 'midi-tiny' && this.tinySynth) {
                    if (this.tinySynth.getPlayTime) {
                        currentTime = this.tinySynth.getPlayTime();
                    }
                    if (this.tinySynth.getTotalTime) {
                        duration = this.tinySynth.getTotalTime();
                    }
                }
                
                this.currentTime = currentTime;
                this.duration = duration;
                
                this.updateActiveVoices();
                
                if (this.uiController) {
                    this.uiController.updateProgress(this.currentTime, this.duration);
                }
                
                // Check if track ended
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
        this.errorCount++;
        this.lastError = { context, error, time: Date.now() };
        
        console.error(`${context}:`, error);
        this.updateStatus(`ERROR: ${context} - ${error.message}`);
        
        if (this.uiController) {
            this.uiController.showError(`${context}: ${error.message}`);
        }
        
        this.stop();
    }
    
    handleInitializationError(error) {
        this.lastError = { context: 'initialization', error };
        
        console.error(`Initialization failed:`, error);
        this.updateStatus(`Initialization failed: ${error.message}`);
        
        if (this.uiController) {
            this.uiController.showError(`Initialization failed: ${error.message}`);
        }
    }
    
    updateStatus(message) {
        console.log('🎵 [Enhanced]', message);
        
        if (this.uiController) {
            this.uiController.updateSystemStatus(message);
        }
    }
    
    // Public API methods
    getStatus() {
        return {
            isPlaying: this.isPlaying,
            isPaused: this.isPaused,
            currentTime: this.currentTime,
            duration: this.duration,
            volume: this.volume,
            currentSynthEngine: this.currentSynthEngine,
            currentSoundFont: this.currentSoundFont,
            activeVoices: this.activeVoices,
            synthesizerReady: this.synthesizerReady,
            errorCount: this.errorCount,
            lastError: this.lastError,
            playbackType: this.playbackType,
            hasChiptunePlayer: !!this.chiptunePlayer,
            hasSpessaSynth: !!this.spessaSynth,
            hasTinySynth: !!this.tinySynth,
            loadedSoundFonts: this.loadedSoundFonts
        };
    }
}