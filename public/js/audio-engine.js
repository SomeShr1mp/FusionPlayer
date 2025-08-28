// Enhanced AudioEngine with proper MIDI progress tracking
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
        this.tinySynth = null;
        this.synthesizerReady = false;
        
        // Always use fallback mode (more compatible)
        this.useAudioWorklet = false;
        this.fallbackMode = true;
        this.initializationPhase = 'starting';
        
        this.uiController = null;
        this.progressInterval = null;
        this.currentPlayback = null;
        this.playbackType = null;
        
        // MIDI-specific tracking
        this.midiStartTime = 0;
        this.midiPausedTime = 0;
        this.midiDuration = 0;
        
        // Error tracking
        this.errorCount = 0;
        this.maxErrors = 5;
        this.lastError = null;
        
        // Performance monitoring
        this.performanceMetrics = {
            initStartTime: performance.now(),
            firstPlayTime: 0
        };
        
        console.log('🎵 AudioEngine v2.1 initialized (Web Audio Direct Mode with MIDI progress fixes)');
    }
    
    setUIController(uiController) {
        this.uiController = uiController;
        this.updateSystemStatus('UI Controller connected');
    }
    
    async initialize() {
        try {
            this.initializationPhase = 'audioContext';
            this.updateSystemStatus('Initializing Web Audio Context...');
            
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) {
                throw new Error('Web Audio API not supported in this browser');
            }
            
            this.audioContext = new AudioContext();
            
            this.gainNode = this.audioContext.createGain();
            this.gainNode.connect(this.audioContext.destination);
            this.gainNode.gain.value = this.volume;
            
            this.audioContext.addEventListener('statechange', () => {
                this.updateSystemStatus(`Audio context: ${this.audioContext.state}`);
            });
            
            this.updateSystemStatus('Audio context initialized ✓');
            
            this.initializationPhase = 'engines';
            this.updateSystemStatus('Using Web Audio Direct Mode (no AudioWorklet)');
            
            await this.initializeAudioEngines();
            
            this.setupUserActivation();
            
            this.initializationPhase = 'complete';
            this.updateSystemStatus('Audio engine ready (Web Audio Direct Mode) ✓');
            
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
        
        try {
            this.updateSystemStatus('Initializing ChiptuneJS engine...');
            await this.initializeChiptuneJS();
            engines.push('ChiptuneJS');
        } catch (error) {
            console.warn('ChiptuneJS initialization failed:', error);
            this.updateSystemStatus('ChiptuneJS initialization failed: ' + error.message);
        }
        
        try {
            this.updateSystemStatus('Initializing TinySynth engine...');
            await this.initializeTinySynth();
            engines.push('TinySynth');
        } catch (error) {
            console.warn('TinySynth initialization failed:', error);
            this.updateSystemStatus('TinySynth initialization failed: ' + error.message);
        }
        
        if (engines.length === 0) {
            throw new Error('No audio engines could be initialized');
        }
        
        this.updateSystemStatus(`Engines ready: ${engines.join(', ')} ✓`);
    }
    
    async initializeChiptuneJS() {
        this.updateSystemStatus('Checking for ChiptuneJS libraries...');
        
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
            console.log('Created libopenmpt reference');
        }
        
        if (typeof UTF8ToString === 'undefined' || typeof writeAsciiToMemory === 'undefined') {
            console.warn('⚠️ Helper functions missing - tracker files may not work properly');
        }
        
        try {
            const config = new ChiptuneJsConfig(-1, 50, 1, this.audioContext);
            this.chiptunePlayer = new ChiptuneJsPlayer(config);
            
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
    
    async initializeTinySynth() {
        this.updateSystemStatus('Checking for TinySynth...');
        
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
            this.tinySynth = new WebAudioTinySynth({
                quality: 1,
                useReverb: 0,
                voices: 32
            });
            
            if (this.tinySynth.getAudioContext) {
                const synthContext = this.tinySynth.getAudioContext();
                console.log('TinySynth audio context:', synthContext ? 'created' : 'not available');
            }
            
            this.synthesizerReady = true;
            this.synthesizer = this.tinySynth;
            
            console.log('✅ TinySynth initialized');
            this.updateSystemStatus('TinySynth ready ✓');
            
        } catch (error) {
            console.error('TinySynth initialization failed:', error);
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
                    this.updateSystemStatus('Audio context activated ✓');
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
                    this.handleError('Audio activation failed', error);
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
            this.updateSystemStatus(`Loading ${trackData.filename}...`);
            
            if (this.performanceMetrics.firstPlayTime === 0) {
                this.performanceMetrics.firstPlayTime = performance.now();
            }
            
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
        if (!this.tinySynth || !this.synthesizerReady) {
            throw new Error('TinySynth not available or not ready');
        }
        
        try {
            this.updateSystemStatus('Loading MIDI file...');
            
            // Get MIDI duration by parsing the file
            await this.getMidiDuration(url);
            
            await new Promise((resolve, reject) => {
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
                        
                        this.updateSystemStatus('TinySynth MIDI playback started ✔');
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
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            
            if (typeof MidiParser !== 'undefined') {
                try {
                    const parser = new MidiParser();
                    const midiData = parser.parse(new Uint8Array(arrayBuffer));
                    this.midiDuration = midiData.duration || 120;
                    this.duration = this.midiDuration;
                    console.log(`📝 MIDI duration parsed: ${this.midiDuration}s`);
                } catch (parseError) {
                    console.warn('MIDI parsing failed, using default duration:', parseError);
                    this.midiDuration = 120;
                    this.duration = 120;
                }
            } else {
                // Estimate duration based on file size
                const estimatedDuration = Math.max(30, Math.min(300, arrayBuffer.byteLength / 1000));
                this.midiDuration = estimatedDuration;
                this.duration = estimatedDuration;
                console.log(`📝 MIDI duration estimated: ${this.midiDuration}s`);
            }
        } catch (error) {
            console.warn('Failed to get MIDI duration:', error);
            this.midiDuration = 120;
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
                this.midiPausedTime = performance.now();
                this.tinySynth.stopMIDI();
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
            } else if (this.currentPlayback?.type === 'midi' && this.tinySynth) {
                // Adjust start time to account for pause duration
                const pauseDuration = performance.now() - this.midiPausedTime;
                this.midiStartTime += pauseDuration;
                this.midiPausedTime = 0;
                
                this.tinySynth.playMIDI();
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
            this.midiStartTime = 0;
            this.midiPausedTime = 0;
            this.midiDuration = 0;
            
            if (this.currentPlayback?.type === 'chiptune' && this.chiptunePlayer) {
                this.chiptunePlayer.stop();
            } else if (this.currentPlayback?.type === 'midi' && this.tinySynth) {
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
        
        if (this.tinySynth && this.tinySynth.setMasterVol) {
            this.tinySynth.setMasterVol(Math.floor(this.volume * 127));
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
                        const synthTime = this.tinySynth.getPlayTime();
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
    
    updateAudioWorkletStatus(status) {
        // No-op since we're not using AudioWorklet
    }
    
    updateOpenMPTStatus(status) {
        if (this.uiController && this.uiController.updateOpenMPTStatus) {
            this.uiController.updateOpenMPTStatus(status);
        }
    }
    
    updateFluidSynthStatus(status) {
        if (this.uiController && this.uiController.updateFluidSynthStatus) {
            this.uiController.updateFluidSynthStatus(status);
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
            hasTinySynth: !!this.tinySynth,
            midiDuration: this.midiDuration
        };
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
                tinySynth: !!this.tinySynth,
                synthesizerReady: this.synthesizerReady
            },
            libraries: {
                Module: typeof Module !== 'undefined',
                libopenmpt: typeof libopenmpt !== 'undefined',
                ChiptuneJsConfig: typeof ChiptuneJsConfig !== 'undefined',
                ChiptuneJsPlayer: typeof ChiptuneJsPlayer !== 'undefined',
                WebAudioTinySynth: typeof WebAudioTinySynth !== 'undefined',
                UTF8ToString: typeof UTF8ToString !== 'undefined',
                writeAsciiToMemory: typeof writeAsciiToMemory !== 'undefined'
            },
            performance: this.performanceMetrics,
            errors: {
                count: this.errorCount,
                lastError: this.lastError
            },
            midi: {
                duration: this.midiDuration,
                startTime: this.midiStartTime,
                pausedTime: this.midiPausedTime
            }
        };
        
        console.log('🔍 Audio Engine Diagnostics:', diagnostics);
        return diagnostics;
    }
}
