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
            quality: 1,      // High quality
            useReverb: 0,    // Disable reverb for better performance
            voices: 32       // More voices for complex MIDI files
        });
        
        // TinySynth automatically connects to its own audio context
        if (this.tinySynth.getAudioContext) {
            const synthContext = this.tinySynth.getAudioContext();
            console.log('TinySynth has audio context:', synthContext);
        }
        
        this.synthesizerReady = true;
        console.log('✅ TinySynth initialized');
        this.updateStatus('TinySynth ready ✔');
    }
    
    async initializeMiddicube() {
        try {
            console.log('Checking for Midicube/MIDI availability...');
            
            // Check if we have either MIDICube wrapper or raw MIDI
            let attempts = 0;
            const maxAttempts = 50;
            
            while (typeof MIDICube === 'undefined' && typeof window.MIDI === 'undefined' && attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
            }
            
            if (attempts >= maxAttempts) {
                console.warn('Midicube/MIDI library not available, skipping initialization');
                return;
            }
            
            // If we have raw MIDI but no MIDICube wrapper, create basic wrapper
            if (typeof MIDICube === 'undefined' && window.MIDI) {
                console.log('Creating fallback MIDICube wrapper for raw MIDI object');
                this.createFallbackWrapper();
            }
            
            // Initialize Midicube with our audio context
            this.midicube = new MIDICube({
                audioContext: this.audioContext,
                gainNode: this.gainNode
            });
            
            this.midicubeReady = true;
            this.availableSynths.push('midicube');
            
            console.log('✅ Midicube initialized successfully');
            this.updateStatus('Midicube ready ✔');
            
        } catch (error) {
            console.warn('Midicube initialization failed:', error);
            // Don't throw - allow other engines to work
        }
    }
    
    createFallbackWrapper() {
        // Emergency fallback if loader didn't work
        window.MIDICube = class MIDICube {
            constructor(options = {}) {
                this.audioContext = options.audioContext;
                this.gainNode = options.gainNode;
                this.midi = window.MIDI;
                console.log('Using emergency MIDICube wrapper');
            }
            
            async loadMIDI(arrayBuffer) {
                console.log('Loading MIDI in fallback wrapper');
                this.midiData = arrayBuffer;
                return Promise.resolve();
            }
            
            async loadSoundfont(data) {
                console.log('Soundfont loading not implemented in fallback wrapper');
            }
            
            play() {
                console.log('Playing with fallback wrapper');
                this.isPlaying = true;
            }
            
            stop() {
                this.isPlaying = false;
            }
            
            noteOn(channel, note, velocity) {
                if (this.midi && this.midi.noteOn) {
                    this.midi.noteOn(channel, note, velocity);
                }
            }
            
            noteOff(channel, note) {
                if (this.midi && this.midi.noteOff) {
                    this.midi.noteOff(channel, note);
                }
            }
            
            getCurrentTime() { return 0; }
            getDuration() { return 0; }
            setVolume(value) {}
        };
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
        // Resume audio context on user interaction
        const resumeAudio = async () => {
            if (this.audioContext && this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
                this.updateStatus('Audio context resumed ✔');
            }
        };
        
        document.addEventListener('click', resumeAudio, { once: true });
        document.addEventListener('touchstart', resumeAudio, { once: true });
    }
    
    async playTrack(fileInfo) {
        try {
            this.updateStatus(`Loading track: ${fileInfo.name}...`);
            
            // Stop any current playback
            if (this.isPlaying) {
                this.stop();
            }
            
            // Fetch the file
            const response = await fetch(`/music/${fileInfo.name}`);
            if (!response.ok) {
                throw new Error(`Failed to fetch file: ${response.statusText}`);
            }
            
            const arrayBuffer = await response.arrayBuffer();
            
            // Determine file type and play accordingly
            const ext = fileInfo.name.split('.').pop().toLowerCase();
            
            if (['mod', 'xm', 'it', 's3m'].includes(ext)) {
                await this.playModuleFile(arrayBuffer, fileInfo.name);
            } else if (['mid', 'midi'].includes(ext)) {
                await this.playMidiFile(arrayBuffer, fileInfo.name);
            } else {
                throw new Error(`Unsupported file format: ${ext}`);
            }
            
        } catch (error) {
            console.error('Playback error:', error);
            this.updateStatus(`Playback failed: ${error.message}`);
            throw error;
        }
    }
    
    async playModuleFile(arrayBuffer, filename) {
        try {
            if (!this.chiptunePlayer) {
                throw new Error('ChiptuneJS not initialized');
            }
            
            this.updateStatus(`Loading module: ${filename}...`);
            
            // Ensure audio context is running
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
            
            // Load the module file
            await new Promise((resolve, reject) => {
                this.chiptunePlayer.load(arrayBuffer, (buffer) => {
                    console.log('Module loaded successfully');
                    resolve(buffer);
                }, (error) => {
                    console.error('Module loading failed:', error);
                    reject(error);
                });
            });
            
            // Get metadata
            const metadata = this.chiptunePlayer.metadata();
            if (metadata) {
                console.log('Module metadata:', metadata);
                this.duration = this.chiptunePlayer.duration();
            }
            
            // Start playback
            this.chiptunePlayer.play();
            
            this.currentPlayback = {
                type: 'module',
                instance: this.chiptunePlayer,
                filename: filename
            };
            
            this.playbackType = 'module';
            this.isPlaying = true;
            this.isPaused = false;
            
            // Start progress updates
            this.startProgressUpdates();
            
            this.updateStatus(`Playing module: ${filename}`);
            
        } catch (error) {
            console.error('Module playback failed:', error);
            throw new Error(`Module playback failed: ${error.message}`);
        }
    }
    
    async playMidiFile(arrayBuffer, filename) {
        try {
            this.updateStatus(`Loading MIDI file: ${filename}...`);
            
            if (this.currentMidiSynth === 'midicube' && this.midicubeReady) {
                // Use Midicube for playback
                await this.midicube.loadMIDI(arrayBuffer);
                
                // Set volume
                this.midicube.setVolume(this.volume);
                
                // Start playback
                this.midicube.play();
                
                this.currentPlayback = {
                    type: 'midicube',
                    instance: this.midicube,
                    filename: filename
                };
                
                this.playbackType = 'midi';
                this.isPlaying = true;
                this.isPaused = false;
                
                // Start progress updates
                this.startProgressUpdates();
                
                this.updateStatus(`Playing MIDI with Midicube: ${filename}`);
                
            } else if (this.synthesizerReady) {
                // Fallback to TinySynth
                console.log('Using TinySynth for MIDI playback');
                
                // Parse MIDI file
                const midiData = parseMIDI(new Uint8Array(arrayBuffer));
                if (!midiData || !midiData.tracks) {
                    throw new Error('Invalid MIDI file');
                }
                
                // Play with TinySynth
                this.playMidiWithTinySynth(midiData, filename);
                
            } else {
                throw new Error('No MIDI synthesizer available');
            }
            
        } catch (error) {
            console.error('MIDI playback failed:', error);
            throw new Error(`MIDI playback failed: ${error.message}`);
        }
    }
    
    playMidiWithTinySynth(midiData, filename) {
        // Reset TinySynth
        this.tinySynth.reset();
        
        // Load MIDI data
        this.tinySynth.loadMIDI(midiData);
        
        // Get duration
        this.duration = midiData.duration || 0;
        
        // Start playback
        this.tinySynth.play();
        
        this.currentPlayback = {
            type: 'tinysynth',
            instance: this.tinySynth,
            midiData: midiData,
            filename: filename
        };
        
        this.playbackType = 'midi';
        this.isPlaying = true;
        this.isPaused = false;
        
        // Start progress updates
        this.startProgressUpdates();
        
        this.updateStatus(`Playing MIDI with TinySynth: ${filename}`);
    }
    
    startProgressUpdates() {
        // Clear any existing interval
        this.stopProgressUpdates();
        
        this.progressInterval = setInterval(() => {
            if (this.currentPlayback && this.currentPlayback.instance) {
                const instance = this.currentPlayback.instance;
                
                if (this.currentPlayback.type === 'module') {
                    // ChiptuneJS progress
                    if (instance.currentPlayingNode) {
                        this.currentTime = instance.currentPlayingNode.context.currentTime - 
                                         instance.currentPlayingNode.startTime;
                        this.duration = instance.duration();
                    }
                } else if (this.currentPlayback.type === 'tinysynth') {
                    // TinySynth progress
                    if (instance.getPlayStatus && instance.getPlayStatus() === 1) {
                        const status = instance.getPlayStatus();
                        if (status && status.currentTime !== undefined) {
                            this.currentTime = status.currentTime;
                        }
                    }
                } else if (this.currentPlayback.type === 'midicube') {
                    // Midicube progress
                    this.currentTime = instance.getCurrentTime();
                    this.duration = instance.getDuration();
                    
                    // Check if playback finished
                    if (!instance.isPlaying && this.isPlaying) {
                        this.handlePlaybackEnded();
                    }
                }
                
                // Update UI
                if (this.uiController) {
                    this.uiController.updateProgress(this.currentTime, this.duration);
                }
            }
        }, 100);
    }
    
    stopProgressUpdates() {
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
        }
    }
    
    handlePlaybackEnded() {
        console.log('Playback ended');
        this.stop();
        
        if (this.uiController) {
            this.uiController.handlePlaybackEnded();
        }
    }
    
    play() {
        if (this.isPaused && this.currentPlayback) {
            this.resume();
        }
    }
    
    pause() {
        if (!this.isPlaying || !this.currentPlayback) {
            return;
        }
        
        const instance = this.currentPlayback.instance;
        
        if (this.currentPlayback.type === 'module') {
            instance.togglePause();
        } else if (this.currentPlayback.type === 'tinysynth') {
            instance.pause();
        } else if (this.currentPlayback.type === 'midicube') {
            instance.pause();
        }
        
        this.isPaused = true;
        this.updateStatus('Paused');
    }
    
    resume() {
        if (!this.isPaused || !this.currentPlayback) {
            return;
        }
        
        const instance = this.currentPlayback.instance;
        
        if (this.currentPlayback.type === 'module') {
            instance.togglePause();
        } else if (this.currentPlayback.type === 'tinysynth') {
            instance.resume();
        } else if (this.currentPlayback.type === 'midicube') {
            instance.resume();
        }
        
        this.isPaused = false;
        this.updateStatus('Resumed');
    }
    
    stop() {
        if (!this.currentPlayback) {
            return;
        }
        
        this.stopProgressUpdates();
        
        const instance = this.currentPlayback.instance;
        
        try {
            if (this.currentPlayback.type === 'module') {
                instance.stop();
            } else if (this.currentPlayback.type === 'tinysynth') {
                instance.stop();
            } else if (this.currentPlayback.type === 'midicube') {
                instance.stop();
            }
        } catch (error) {
            console.error('Error stopping playback:', error);
        }
        
        this.currentPlayback = null;
        this.playbackType = null;
        this.isPlaying = false;
        this.isPaused = false;
        this.currentTime = 0;
        
        this.updateStatus('Stopped');
    }
    
    setVolume(value) {
        this.volume = Math.max(0, Math.min(1, value));
        
        if (this.gainNode) {
            this.gainNode.gain.value = this.volume;
        }
        
        // Update synth volumes
        if (this.tinySynth) {
            this.tinySynth.setMasterVol(Math.round(this.volume * 127));
        }
        
        if (this.midicube) {
            this.midicube.setVolume(this.volume);
        }
        
        // Update ChiptuneJS volume if playing
        if (this.currentPlayback && this.currentPlayback.type === 'module') {
            const instance = this.currentPlayback.instance;
            if (instance.currentPlayingNode && instance.currentPlayingNode.gainNode) {
                instance.currentPlayingNode.gainNode.gain.value = this.volume;
            }
        }
    }
    
    seek(position) {
        if (!this.currentPlayback || !this.duration) {
            return;
        }
        
        const seekTime = position * this.duration;
        
        if (this.currentPlayback.type === 'module') {
            // ChiptuneJS doesn't support seeking well
            console.warn('Seeking not fully supported for module files');
        } else if (this.currentPlayback.type === 'tinysynth') {
            // TinySynth seeking is limited
            console.warn('Seeking not fully supported for TinySynth');
        } else if (this.currentPlayback.type === 'midicube' && this.midicube.seek) {
            this.midicube.seek(seekTime);
        }
    }
    
    updateStatus(message) {
        console.log(`📊 Status: ${message}`);
        if (this.uiController) {
            this.uiController.updateSystemStatus(message);
        }
    }
    
    // Diagnostic methods
    getEngineStatus() {
        return {
            audioContext: this.audioContext ? this.audioContext.state : 'not initialized',
            chiptuneJS: this.chiptunePlayer ? 'ready' : 'not initialized',
            tinySynth: this.synthesizerReady ? 'ready' : 'not initialized',
            midicube: this.midicubeReady ? 'ready' : 'not initialized',
            currentSynth: this.currentMidiSynth,
            availableSynths: this.availableSynths,
            soundfonts: this.loadedSoundfonts.length,
            isPlaying: this.isPlaying,
            isPaused: this.isPaused,
            playbackType: this.playbackType
        };
    }
    
    async testAudioPath() {
        try {
            // Create a test oscillator
            const oscillator = this.audioContext.createOscillator();
            const testGain = this.audioContext.createGain();
            
            oscillator.connect(testGain);
            testGain.connect(this.audioContext.destination);
            
            testGain.gain.value = 0.1;
            oscillator.frequency.value = 440;
            
            oscillator.start();
            setTimeout(() => oscillator.stop(), 200);
            
            this.updateStatus('Audio path test: Success ✔');
            return true;
        } catch (error) {
            this.updateStatus('Audio path test failed: ' + error.message);
            return false;
        }
    }
}

// Make globally available
window.FallbackAudioEngine = FallbackAudioEngine;
