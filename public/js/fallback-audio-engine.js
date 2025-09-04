// Enhanced Fallback AudioEngine with proper Web Audio connections and SpessaSynth support
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
        this.tinySynth = null;
        this.spessaSynth = null; // SpessaSynth engine
        this.synthesizerReady = false;
        this.spessaSynthReady = false;
        
        // Playback state
        this.currentPlayback = null;
        this.playbackType = null;
        this.progressInterval = null;
        
        // UI Controller
        this.uiController = null;
        
        // ScriptProcessor for monitoring (if needed)
        this.monitorNode = null;
        
        console.log('🎵 FallbackAudioEngine v2.3 initialized (with SpessaSynth support)');
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
        
        // Initialize SpessaSynth (if available) - Higher priority than TinySynth
        try {
            this.updateStatus('Checking for SpessaSynth engine...');
            
            if (typeof SpessaSynthEngine !== 'undefined') {
                this.updateStatus('Initializing SpessaSynth engine...');
                this.spessaSynth = new SpessaSynthEngine();
                await this.spessaSynth.initialize(this.audioContext);
                this.spessaSynthReady = true;
                engines.push('SpessaSynth');
                this.updateStatus('SpessaSynth ready ✔');
            } else if (typeof SpessaSynth !== 'undefined') {
                // Try direct SpessaSynth initialization if wrapper not available
                this.updateStatus('Initializing SpessaSynth directly...');
                await this.initializeSpessaSynthDirect();
                if (this.spessaSynthReady) {
                    engines.push('SpessaSynth');
                }
            }
        } catch (error) {
            console.warn('SpessaSynth initialization failed:', error);
            this.spessaSynthReady = false;
        }
        
        // Initialize TinySynth as fallback
        try {
            this.updateStatus('Initializing TinySynth engine...');
            await this.initializeTinySynth();
            engines.push('TinySynth');
        } catch (error) {
            console.warn('TinySynth initialization failed:', error);
        }
        
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
    
    async initializeSpessaSynthDirect() {
        try {
            // Direct SpessaSynth initialization
            if (!SpessaSynth || !SpessaSynth.Synthesizer) {
                throw new Error('SpessaSynth.Synthesizer not available');
            }
            
            // Create a custom wrapper for direct SpessaSynth
            this.spessaSynth = {
                synth: null,
                audioContext: this.audioContext,
                isReady: false,
                currentMidi: null,
                
                async initialize(audioContext) {
                    this.synth = new SpessaSynth.Synthesizer(
                        audioContext.destination,
                        {
                            voiceCap: 128,
                            useReverb: true,
                            useChorus: true
                        }
                    );
                    
                    // Try to load a soundfont
                    const soundFontPaths = [
                        '/soundfonts/spessasynth/gm.sf2',
                        '/soundfonts/default.sf2'
                    ];
                    
                    for (const path of soundFontPaths) {
                        try {
                            const response = await fetch(path);
                            if (response.ok) {
                                const arrayBuffer = await response.arrayBuffer();
                                await this.synth.loadSoundFont(arrayBuffer);
                                console.log(`✅ Soundfont loaded: ${path}`);
                                break;
                            }
                        } catch (error) {
                            console.warn(`Failed to load soundfont ${path}:`, error);
                        }
                    }
                    
                    this.isReady = true;
                },
                
                async loadMidiFile(url) {
                    const response = await fetch(url);
                    const arrayBuffer = await response.arrayBuffer();
                    this.currentMidi = new SpessaSynth.MIDI(arrayBuffer);
                    this.synth.loadMIDI(this.currentMidi);
                },
                
                play() {
                    if (this.synth) this.synth.play();
                },
                
                pause() {
                    if (this.synth) this.synth.pause();
                },
                
                stop() {
                    if (this.synth) {
                        this.synth.stop();
                        this.currentMidi = null;
                    }
                },
                
                setVolume(volume) {
                    if (this.synth) {
                        this.synth.setMainVolume(Math.floor(volume * 127));
                    }
                },
                
                getCurrentTime() {
                    return this.synth?.currentTime || 0;
                },
                
                getDuration() {
                    return this.currentMidi?.duration || 0;
                }
            };
            
            await this.spessaSynth.initialize(this.audioContext);
            this.spessaSynthReady = true;
            
            console.log('✅ SpessaSynth initialized directly');
            this.updateStatus('SpessaSynth ready ✔');
            
        } catch (error) {
            console.error('Direct SpessaSynth initialization failed:', error);
            this.spessaSynthReady = false;
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
        
        // Create TinySynth with proper Web Audio connection
        this.tinySynth = new WebAudioTinySynth({
            quality: 1,      // High quality
            useReverb: 0,    // Disable reverb for better performance
            voices: 32       // More voices for complex MIDI files
        });
        
        // TinySynth creates its own audio context, we need to connect it
        if (this.tinySynth.getAudioContext) {
            const synthContext = this.tinySynth.getAudioContext();
            console.log('TinySynth has audio context:', synthContext);
        }
        
        this.synthesizerReady = true;
        console.log('✅ TinySynth initialized');
        this.updateStatus('TinySynth ready ✔');
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
        // Try SpessaSynth first (better quality)
        if (this.spessaSynth && (this.spessaSynthReady || this.spessaSynth.isReady)) {
            try {
                this.updateStatus('Loading MIDI with SpessaSynth...');
                await this.spessaSynth.loadMidiFile(url);
                this.spessaSynth.play();
                
                this.currentPlayback = { 
                    type: 'midi', 
                    engine: 'spessasynth',
                    player: this.spessaSynth 
                };
                
                this.duration = this.spessaSynth.getDuration();
                this.startProgressMonitoring();
                this.updateStatus('SpessaSynth MIDI playback started ✔');
                return;
            } catch (error) {
                console.warn('SpessaSynth playback failed, trying TinySynth:', error);
                // Fall through to TinySynth
            }
        }
        
        // Fallback to TinySynth
        if (!this.tinySynth || !this.synthesizerReady) {
            throw new Error('No MIDI synthesis engine available');
        }
        
        try {
            this.updateStatus('Loading MIDI file with TinySynth...');
            
            // TinySynth can load MIDI directly from URL
            await new Promise((resolve, reject) => {
                // Use loadMIDIUrl which properly handles the MIDI loading
                this.tinySynth.loadMIDIUrl(url);
                
                // Wait a moment for loading
                setTimeout(() => {
                    try {
                        this.tinySynth.playMIDI();
                        this.currentPlayback = { 
                            type: 'midi',
                            engine: 'tinysynth',
                            player: this.tinySynth 
                        };
                        
                        // Get duration if available
                        if (this.tinySynth.getTotalTime) {
                            this.duration = this.tinySynth.getTotalTime();
                        }
                        
                        // Start progress monitoring
                        this.startProgressMonitoring();
                        
                        this.updateStatus('TinySynth MIDI playback started ✔');
                        resolve();
                    } catch (playError) {
                        reject(playError);
                    }
                }, 500); // Give it time to load
            });
            
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
                } else if (this.currentPlayback.engine === 'tinysynth' && this.tinySynth) {
                    // TinySynth doesn't have a pause, so we stop and track position
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
        
        // SpessaSynth volume control
        if (this.spessaSynth && this.spessaSynth.setVolume) {
            this.spessaSynth.setVolume(this.volume);
        }
        
        // TinySynth has its own volume control
        if (this.tinySynth) {
            this.tinySynth.setMasterVol(Math.floor(this.volume));
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
                        // SpessaSynth progress
                        currentTime = this.spessaSynth.getCurrentTime();
                        duration = this.spessaSynth.getDuration();
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
            spessaSynthReady: this.spessaSynthReady,
            playbackType: this.playbackType,
            currentEngine: this.currentPlayback?.engine || null,
            hasChiptunePlayer: !!this.chiptunePlayer,
            hasSpessaSynth: !!this.spessaSynth,
            hasTinySynth: !!this.tinySynth
        };
    }
}
