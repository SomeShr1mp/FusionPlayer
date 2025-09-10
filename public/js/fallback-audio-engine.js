// Enhanced Fallback AudioEngine with proper MIDI progress tracking
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
        this.synthesizerReady = false;
        
        // Playback state
        this.currentPlayback = null;
        this.playbackType = null;
        this.progressInterval = null;
        
        // MIDI-specific tracking
        this.midiStartTime = 0;
        this.midiPausedTime = 0;
        this.midiDuration = 0;
        
        // UI Controller
        this.uiController = null;
        
        console.log('🎵 FallbackAudioEngine v2.1 initialized with MIDI progress fixes');
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
        
        // Initialize TinySynth with proper connection
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
        
        if (!window.libopenmpt) {
            window.libopenmpt = Module;
        }
        
        const config = new ChiptuneJsConfig(-1, 50, 1, this.audioContext);
        this.chiptunePlayer = new ChiptuneJsPlayer(config);
        
        console.log('✅ ChiptuneJS player initialized with audio context');
        this.updateStatus('ChiptuneJS ready ✔');
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
        
        this.tinySynth = new WebAudioTinySynth({
            quality: 1,
            useReverb: 0,
            voices: 128
        });
        
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
        if (!this.tinySynth || !this.synthesizerReady) {
            throw new Error('TinySynth not available or not ready');
        }
        
        try {
            this.updateStatus('Loading MIDI file...');
            
            // First, try to get MIDI duration by parsing the file
            await this.getMidiDuration(url);
            
            await new Promise((resolve, reject) => {
                // Load MIDI file
                this.tinySynth.loadMIDIUrl(url);
                
                setTimeout(() => {
                    try {
                        this.tinySynth.playMIDI();
                        this.currentPlayback = { 
                            type: 'midi', 
                            player: this.tinySynth 
                        };
                        
                        // Record start time for manual progress tracking
                        this.midiStartTime = performance.now();
                        this.midiPausedTime = 0;
                        
                        // Try to get duration from TinySynth if available
                        if (this.tinySynth.getTotalTime && this.midiDuration === 0) {
                            const synthDuration = this.tinySynth.getTotalTime();
                            if (synthDuration > 0) {
                                this.midiDuration = synthDuration;
                                this.duration = synthDuration;
                            }
                        }
                        
                        this.startProgressMonitoring();
                        
                        this.updateStatus('TinySynth MIDI playback started ✔');
                        resolve();
                    } catch (playError) {
                        reject(playError);
                    }
                }, 500);
            });
            
        } catch (error) {
            throw new Error(`MIDI playback failed: ${error.message}`);
        }
    }
    
    async getMidiDuration(url) {
        try {
            // Try to get MIDI file and parse it for duration
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            
            if (typeof MidiParser !== 'undefined') {
                try {
                    const parser = new MidiParser();
                    const midiData = parser.parse(new Uint8Array(arrayBuffer));
                    this.midiDuration = midiData.duration || 120; // Default to 2 minutes
                    this.duration = this.midiDuration;
                    console.log(`📝 MIDI duration parsed: ${this.midiDuration}s`);
                } catch (parseError) {
                    console.warn('MIDI parsing failed, using default duration:', parseError);
                    this.midiDuration = 120; // Default 2 minutes
                    this.duration = 120;
                }
            } else {
                // Fallback: estimate duration based on file size
                const estimatedDuration = Math.max(30, Math.min(300, arrayBuffer.byteLength / 1000));
                this.midiDuration = estimatedDuration;
                this.duration = estimatedDuration;
                console.log(`📝 MIDI duration estimated: ${this.midiDuration}s`);
            }
        } catch (error) {
            console.warn('Failed to get MIDI duration:', error);
            this.midiDuration = 120; // Default 2 minutes
            this.duration = 120;
        }
    }
    
    pause() {
        if (!this.isPlaying || this.isPaused) return;
        
        try {
            this.isPaused = true;
            
            if (this.currentPlayback?.type === 'chiptune' && this.chiptunePlayer) {
                this.chiptunePlayer.togglePause();
            } else if (this.currentPlayback?.type === 'midi' && this.tinySynth) {
                this.tinySynth.stopMIDI();
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
            } else if (this.currentPlayback?.type === 'midi' && this.tinySynth) {
		this.tinySynth.playMIDI();
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
            this.midiStartTime = 0;
            this.midiPausedTime = 0;
            this.midiDuration = 0;
            
            if (this.currentPlayback?.type === 'chiptune' && this.chiptunePlayer) {
                this.chiptunePlayer.stop();
            } else if (this.currentPlayback?.type === 'midi' && this.tinySynth) {
                this.tinySynth.stopMIDI();
                // Send all notes off
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
        
        if (this.tinySynth && this.tinySynth.setMasterVol) {
            this.tinySynth.setMasterVol(this.volume);
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
                } else if (this.currentPlayback?.type === 'midi' && this.tinySynth) {
                    // Enhanced MIDI progress tracking
                    duration = this.midiDuration || this.duration;
                    
                    // Try TinySynth methods first
                    if (this.tinySynth.getPlayTime) {
                        const synthTime = this.tinySynth.getPlayStatus()['curTick'] * this.tinySynth.tick2Time;
                        if (synthTime > 0) {
                            currentTime = synthTime;
                        }
                    }
                    
                    // Fallback to manual time calculation
                    if (currentTime === 0 && this.midiStartTime > 0 && !this.isPaused) {
                        currentTime = (performance.now() - this.midiStartTime) / 1000;
                    }
                    
                    // Ensure we don't exceed duration
                    if (duration > 0 && currentTime > duration) {
                        currentTime = duration;
                    }
                }
                
                this.currentTime = currentTime;
                this.duration = duration;
                
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
            hasTinySynth: !!this.tinySynth,
            midiDuration: this.midiDuration
        };
    }
}
