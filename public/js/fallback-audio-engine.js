// Enhanced Fallback AudioEngine with Midicube support
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
        this.midicube = null;
        this.synthesizerReady = false;
        this.midicubeReady = false;

        // MIDI synth management
        this.currentMidiSynth = 'tinysynth'; // Default to TinySynth
        this.availableSynths = ['tinysynth'];
        this.loadedSoundfonts = [];
        this.currentSoundfont = null;

        // Playback state
        this.currentPlayback = null;
        this.playbackType = null;
        this.progressInterval = null;

        // UI Controller
        this.uiController = null;

        // ScriptProcessor for monitoring (if needed)
        this.monitorNode = null;

        console.log('🎵 FallbackAudioEngine v2.3.5 initialized with Midicube support');
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

            // Load SoundFonts list
            await this.loadSoundfontsList();

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

        // Initialize Midicube
        try {
            this.updateStatus('Initializing Midicube engine...');
            await this.initializeMiddicube();
            engines.push('Midicube');
        } catch (error) {
            console.warn('Midicube initialization failed:', error);
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

        // Create TinySynth with proper Web Audio connection
        this.tinySynth = new WebAudioTinySynth({
            quality: 1, // High quality
            useReverb: 0, // Disable reverb for better performance
            voices: 32 // More voices for complex MIDI files
        });

        // TinySynth automatically connects to its own audio context
        if (this.tinySynth.getAudioContext) {
            const synthContext = this.tinySynth.getAudioContext();
            console.log('TinySynth has audio context:', synthContext);
        }

        this.synthesizerReady = true;
        this.availableSynths.push('tinysynth');
        console.log('✅ TinySynth initialized');
        this.updateStatus('TinySynth ready ✔');
    }

    async initializeMiddicube() {
        try {
            // First check if MIDICube is available globally
            if (typeof window.MIDICube === 'undefined' && typeof MIDICube === 'undefined') {
                // Try to load it dynamically
                await this.loadMidicubeLibrary();
            }

            // Wait for Midicube library with better error handling
            let attempts = 0;
            const maxAttempts = 50;

            while (typeof MIDICube === 'undefined' && attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
            }

            if (attempts >= maxAttempts) {
                console.warn('Midicube library not available, skipping initialization');
                return; // Don't throw, just skip
            }

            // Initialize Midicube with our audio context
            this.midicube = new MIDICube({
                audioContext: this.audioContext,
                gainNode: this.gainNode
            });

            this.midicubeReady = true;
            this.availableSynths.push('midicube');

            console.log('✅ Midicube initialized');
            this.updateStatus('Midicube ready ✔');

        } catch (error) {
            console.warn('Midicube initialization skipped:', error);
            // Don't throw - allow other engines to work
        }
    }

    // Add this helper method to load Midicube dynamically
    async loadMidicubeLibrary() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = '/node_modules/midicube/releases/midicube.js'; // or use CDN
            script.onload = resolve;
            script.onerror = () => {
                console.warn('Failed to load Midicube library dynamically');
                resolve(); // Resolve anyway to continue
            };
            document.head.appendChild(script);
        });
    }

    async loadSoundfontsList() {
        try {
            const response = await fetch('/api/soundfonts');
            const soundfonts = await response.json();
            this.loadedSoundfonts = soundfonts;

            if (this.uiController) {
                this.uiController.updateSoundfontsList(soundfonts);
            }

            console.log(`✅ Found ${soundfonts.length} SoundFonts`);
        } catch (error) {
            console.warn('Failed to load SoundFonts list:', error);
            this.loadedSoundfonts = [];
        }
    }

    async setSynthType(synthType) {
        if (!this.availableSynths.includes(synthType)) {
            throw new Error(`Synth type '${synthType}' not available`);
        }

        // Stop current playback if MIDI
        if (this.isPlaying && this.playbackType === 'midi') {
            this.stop();
        }

        this.currentMidiSynth = synthType;
        this.updateStatus(`MIDI synth set to: ${synthType}`);

        if (this.uiController) {
            this.uiController.updateSynthSelector(synthType);
        }
    }

    async loadSoundfont(soundfontFilename) {
        if (!this.midicubeReady) {
            throw new Error('Midicube not ready');
        }

        try {
            this.updateStatus(`Loading SoundFont: ${soundfontFilename}...`);

            const response = await fetch(`/soundfonts/${soundfontFilename}`);
            if (!response.ok) {
                throw new Error(`Failed to fetch SoundFont: ${response.statusText}`);
            }

            const soundfontData = await response.arrayBuffer();
            await this.midicube.loadSoundfont(soundfontData);

            this.currentSoundfont = soundfontFilename;
            this.updateStatus(`SoundFont loaded: ${soundfontFilename} ✔`);

            if (this.uiController) {
                this.uiController.updateSoundfontStatus('loaded', soundfontFilename);
            }

            console.log(`✅ SoundFont loaded: ${soundfontFilename}`);

        } catch (error) {
            this.updateStatus(`SoundFont loading failed: ${error.message}`);
            if (this.uiController) {
                this.uiController.updateSoundfontStatus('error', error.message);
            }
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
                } catch (error) {
                    console.error('Failed to activate audio context:', error);
                }
            }
        };

        // Setup activation on various user interactions
        ['click', 'touchstart', 'keydown'].forEach(event => {
            document.addEventListener(event, activateAudio, {
                once: true
            });
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
        const currentSynth = this.getCurrentMidiSynth();

        if (!currentSynth) {
            throw new Error('No MIDI synthesizer available');
        }

        try {
            this.updateStatus(`Loading MIDI file with ${this.currentMidiSynth}...`);

            if (this.currentMidiSynth === 'tinysynth') {
                await this.playMidiWithTinySynth(url);
            } else if (this.currentMidiSynth === 'midicube') {
                await this.playMidiWithMidicube(url);
            }

            this.currentPlayback = {
                type: 'midi',
                player: currentSynth,
                synthType: this.currentMidiSynth
            };

            // Start progress monitoring
            this.startProgressMonitoring();

            this.updateStatus(`${this.currentMidiSynth} MIDI playback started ✔`);

        } catch (error) {
            throw new Error(`MIDI playback failed: ${error.message}`);
        }
    }

    async playMidiWithTinySynth(url) {
        if (!this.tinySynth || !this.synthesizerReady) {
            throw new Error('TinySynth not available or not ready');
        }

        // TinySynth can load MIDI directly from URL
        await new Promise((resolve, reject) => {
            this.tinySynth.loadMIDIUrl(url);

            // Wait a moment for loading
            setTimeout(() => {
                try {
                    this.tinySynth.playMIDI();

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
    }

    async playMidiWithMidicube(url) {
        if (!this.midicube || !this.midicubeReady) {
            throw new Error('Midicube not available or not ready');
        }

        if (!this.currentSoundfont) {
            throw new Error('No SoundFont loaded for Midicube');
        }

        try {
            // Download MIDI file
            const response = await fetch(url);
            const midiData = await response.arrayBuffer();

            // Load and play MIDI with Midicube
            await this.midicube.loadMIDI(midiData);
            this.midicube.play();

            // Get duration if available
            if (this.midicube.getDuration) {
                this.duration = this.midicube.getDuration();
            }

        } catch (error) {
            throw new Error(`Midicube playback failed: ${error.message}`);
        }
    }

    getCurrentMidiSynth() {
        switch (this.currentMidiSynth) {
            case 'tinysynth':
                return this.tinySynth;
            case 'midicube':
                return this.midicube;
            default:
                return null;
        }
    }

    pause() {
        if (!this.isPlaying || this.isPaused) return;

        try {
            this.isPaused = true;

            if (this.currentPlayback?.type === 'chiptune' && this.chiptunePlayer) {
                this.chiptunePlayer.togglePause();
            } else if (this.currentPlayback?.type === 'midi') {
                if (this.currentPlayback.synthType === 'tinysynth' && this.tinySynth) {
                    // TinySynth doesn't have pause, so we stop and track position
                    if (this.tinySynth.getPlayTime) {
                        this.pausedPosition = this.tinySynth.getPlayTime();
                    }
                    this.tinySynth.stopMIDI();
                } else if (this.currentPlayback.synthType === 'midicube' && this.midicube) {
                    this.midicube.pause();
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
                if (this.currentPlayback.synthType === 'tinysynth' && this.tinySynth) {
                    // Resume MIDI from saved position
                    this.tinySynth.playMIDI();
                    if (this.pausedPosition && this.tinySynth.setPlayTime) {
                        this.tinySynth.setPlayTime(this.pausedPosition);
                    }
                } else if (this.currentPlayback.synthType === 'midicube' && this.midicube) {
                    this.midicube.resume();
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
                if (this.currentPlayback.synthType === 'tinysynth' && this.tinySynth) {
                    this.tinySynth.stopMIDI();
                    // Send all notes off
                    for (let ch = 0; ch < 16; ch++) {
                        this.tinySynth.send([0xB0 | ch, 123, 0], 0);
                    }
                } else if (this.currentPlayback.synthType === 'midicube' && this.midicube) {
                    this.midicube.stop();
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

        // TinySynth has its own volume control
        if (this.tinySynth && this.tinySynth.setMasterVol) {
            this.tinySynth.setMasterVol(Math.floor(this.volume * 127));
        }

        // Midicube volume is controlled through the gain node
        if (this.midicube && this.midicube.setVolume) {
            this.midicube.setVolume(this.volume);
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
                    if (this.currentPlayback.synthType === 'tinysynth' && this.tinySynth) {
                        // TinySynth progress methods
                        if (this.tinySynth.getPlayTime) {
                            currentTime = this.tinySynth.getPlayTime();
                        }
                        if (this.tinySynth.getTotalTime) {
                            duration = this.tinySynth.getTotalTime();
                        }
                    } else if (this.currentPlayback.synthType === 'midicube' && this.midicube) {
                        // Midicube progress methods
                        if (this.midicube.getCurrentTime) {
                            currentTime = this.midicube.getCurrentTime();
                        }
                        if (this.midicube.getDuration) {
                            duration = this.midicube.getDuration();
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
    get fallbackMode() {
        return true;
    }
    get useAudioWorklet() {
        return false;
    }

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
            midicubeReady: this.midicubeReady,
            playbackType: this.playbackType,
            currentMidiSynth: this.currentMidiSynth,
            availableSynths: this.availableSynths,
            currentSoundfont: this.currentSoundfont,
            loadedSoundfonts: this.loadedSoundfonts,
            hasChiptunePlayer: !!this.chiptunePlayer,
            hasTinySynth: !!this.tinySynth,
            hasMidicube: !!this.midicube
        };
    }
}