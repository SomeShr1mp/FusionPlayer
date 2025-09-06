// fallback-audio-engine.js
// Enhanced Audio Engine with MIDI, MOD, OpenMPT support, and Midicube integration
// Uses Web Audio Direct Mode with ScriptProcessor instead of AudioWorklet

(function(window) {
    'use strict';

    class FallbackAudioEngine {
        constructor() {
            this.audioContext = null;
            this.currentPlayer = null;
            this.scriptNode = null;
            this.isPlaying = false;
            this.volume = 0.7;
            this.selectedSynth = 'tinysynth'; // Default synth
            
            // Player instances
            this.chiptunePlayer = null;
            this.tinySynth = null;
            this.midicube = null;
            
            // File info
            this.currentFile = null;
            this.fileType = null;
            
            // Progress tracking
            this.startTime = 0;
            this.pauseTime = 0;
            
            // System checks
            this.systemStatus = {
                audioContext: false,
                chiptune: false,
                tinysynth: false,
                midicube: false,
                openmpt: false
            };
        }

        async initialize() {
            try {
                await this.log('Initializing Fallback Audio Engine...');
                
                // Initialize audio context
                await this.initializeAudioContext();
                
                // Initialize all audio engines
                await this.initializeAudioEngines();
                
                // Check system status
                this.checkSystemStatus();
                
                await this.log('Fallback Audio Engine initialized successfully', 'SUCCESS');
                return true;
            } catch (error) {
                await this.log(`Failed to initialize audio engine: ${error.message}`, 'ERROR');
                throw error;
            }
        }

        async initializeAudioContext() {
            try {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                this.audioContext = new AudioContext({
                    sampleRate: 44100,
                    latencyHint: 'playback'
                });
                
                // Handle Safari's suspended context
                if (this.audioContext.state === 'suspended') {
                    await this.audioContext.resume();
                }
                
                this.systemStatus.audioContext = true;
                await this.log('Audio context initialized');
            } catch (error) {
                await this.log(`Audio context initialization failed: ${error.message}`, 'ERROR');
                throw error;
            }
        }

        async initializeAudioEngines() {
            const results = await Promise.allSettled([
                this.initializeChiptune(),
                this.initializeTinySynth(),
                this.initializeMidicube(),
                this.initializeOpenMPT()
            ]);
            
            results.forEach((result, index) => {
                const engines = ['ChiptuneJS', 'TinySynth', 'Midicube', 'OpenMPT'];
                if (result.status === 'rejected') {
                    this.log(`${engines[index]} initialization failed: ${result.reason}`, 'WARNING');
                }
            });
        }

        async initializeChiptune() {
            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    try {
                        if (typeof ChiptuneAudioContext !== 'undefined') {
                            this.chiptunePlayer = new ChiptuneAudioContext(this.audioContext);
                            this.systemStatus.chiptune = true;
                            this.log('ChiptuneJS ready ✔');
                            resolve();
                        } else {
                            reject(new Error('ChiptuneJS not found'));
                        }
                    } catch (error) {
                        reject(error);
                    }
                }, 100);
            });
        }

        async initializeTinySynth() {
            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    try {
                        if (typeof WebAudioTinySynth !== 'undefined') {
                            this.tinySynth = new WebAudioTinySynth({
                                quality: 2,
                                useReverb: 1,
                                voices: 64
                            });
                            this.tinySynth.setAudioContext(this.audioContext, this.audioContext.destination);
                            this.systemStatus.tinysynth = true;
                            this.log('TinySynth ready ✔');
                            resolve();
                        } else {
                            reject(new Error('TinySynth not found'));
                        }
                    } catch (error) {
                        reject(error);
                    }
                }, 100);
            });
        }

        async initializeMidicube() {
            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    try {
                        // Debug: Check what's available
                        console.log('🔍 [DEBUG] Checking for Midicube...');
                        console.log('🔍 [DEBUG] typeof MIDICube:', typeof MIDICube);
                        console.log('🔍 [DEBUG] typeof window.MIDICube:', typeof window.MIDICube);
                        console.log('🔍 [DEBUG] typeof MIDI:', typeof MIDI);
                        console.log('🔍 [DEBUG] typeof window.MIDI:', typeof window.MIDI);
                        
                        // Try multiple ways to find Midicube
                        let MidicubeConstructor = null;
                        
                        // Method 1: Direct global
                        if (typeof MIDICube !== 'undefined') {
                            MidicubeConstructor = MIDICube;
                        }
                        // Method 2: Window property
                        else if (window.MIDICube) {
                            MidicubeConstructor = window.MIDICube;
                        }
                        // Method 3: MIDI.Cube or similar
                        else if (typeof MIDI !== 'undefined' && MIDI.Cube) {
                            MidicubeConstructor = MIDI.Cube;
                        }
                        // Method 4: Check if it's a different export format
                        else if (typeof Midicube !== 'undefined') {
                            MidicubeConstructor = Midicube;
                        }
                        else if (window.Midicube) {
                            MidicubeConstructor = window.Midicube;
                        }
                        
                        if (MidicubeConstructor) {
                            console.log('✅ [DEBUG] Found Midicube constructor!');
                            
                            // Initialize Midicube with configuration
                            this.midicube = new MidicubeConstructor({
                                soundfontUrl: 'https://cdn.jsdelivr.net/npm/soundfont-player@0.12.0/soundfonts/',
                                instrument: 'acoustic_grand_piano',
                                audioContext: this.audioContext,
                                destination: this.audioContext.destination
                            });
                            
                            this.systemStatus.midicube = true;
                            this.log('Midicube ready ✔');
                            resolve();
                        } else {
                            // Additional debug info
                            console.log('🔍 [DEBUG] Available global objects:', Object.keys(window).filter(k => k.toLowerCase().includes('midi')));
                            reject(new Error('Midicube library not found'));
                        }
                    } catch (error) {
                        console.error('❌ [DEBUG] Midicube initialization error:', error);
                        reject(error);
                    }
                }, 200); // Give more time for the library to load
            });
        }

        async initializeOpenMPT() {
            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    try {
                        const hasModule = typeof Module !== 'undefined';
                        const hasLibopenmpt = typeof libopenmpt !== 'undefined';
                        
                        if (hasModule || hasLibopenmpt) {
                            const mod = hasModule ? Module : libopenmpt;
                            
                            // Check for required functions
                            const requiredFunctions = [
                                '_openmpt_module_create_from_memory',
                                '_openmpt_module_read_float_stereo',
                                '_openmpt_module_destroy',
                                '_malloc',
                                '_free'
                            ];
                            
                            const allFunctionsAvailable = requiredFunctions.every(func => 
                                typeof mod[func] === 'function'
                            );
                            
                            if (allFunctionsAvailable) {
                                this.systemStatus.openmpt = true;
                                this.log('OpenMPT ready ✔');
                                resolve();
                            } else {
                                reject(new Error('OpenMPT functions not available'));
                            }
                        } else {
                            reject(new Error('OpenMPT module not found'));
                        }
                    } catch (error) {
                        reject(error);
                    }
                }, 100);
            });
        }

        setSynth(synthType) {
            this.selectedSynth = synthType;
            this.log(`Synth changed to: ${synthType}`);
            
            // If a MIDI file is currently loaded, switch the synth
            if (this.fileType === 'midi' && this.currentFile) {
                this.stop();
                // The new synth will be used when play is called again
            }
        }

        async loadFile(file) {
            try {
                this.stop();
                
                await this.log(`Loading file: ${file.name}`);
                
                // Detect file type
                this.fileType = this.detectFileType(file.name);
                await this.log(`Detected file type: ${this.fileType}`);
                
                // Read file
                const arrayBuffer = await this.readFile(file);
                this.currentFile = new Uint8Array(arrayBuffer);
                
                // Load based on type
                switch(this.fileType) {
                    case 'mod':
                    case 'xm':
                    case 's3m':
                    case 'it':
                        await this.loadTrackerModule();
                        break;
                    case 'midi':
                    case 'mid':
                        await this.loadMIDI();
                        break;
                    default:
                        throw new Error(`Unsupported file type: ${this.fileType}`);
                }
                
                await this.log(`File loaded successfully: ${file.name}`, 'SUCCESS');
                return true;
            } catch (error) {
                await this.log(`Failed to load file: ${error.message}`, 'ERROR');
                throw error;
            }
        }

        detectFileType(filename) {
            const ext = filename.split('.').pop().toLowerCase();
            const trackerFormats = ['mod', 'xm', 's3m', 'it', 'mptm', 'stm', 'nst', 'ult', '669'];
            const midiFormats = ['mid', 'midi', 'kar', 'rmi'];
            
            if (trackerFormats.includes(ext)) {
                return ext;
            } else if (midiFormats.includes(ext)) {
                return 'midi';
            }
            return 'unknown';
        }

        async readFile(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = reject;
                reader.readAsArrayBuffer(file);
            });
        }

        async loadTrackerModule() {
            if (!this.chiptunePlayer) {
                throw new Error('ChiptuneJS not initialized');
            }
            
            try {
                // Stop any existing playback
                if (this.chiptunePlayer.currentPlayingNode) {
                    this.chiptunePlayer.currentPlayingNode.stop();
                    this.chiptunePlayer.currentPlayingNode = null;
                }
                
                // Load the module
                const result = await new Promise((resolve, reject) => {
                    this.chiptunePlayer.load(this.currentFile.buffer, (buffer) => {
                        resolve(buffer);
                    }, (error) => {
                        reject(error);
                    });
                });
                
                this.currentPlayer = 'chiptune';
                await this.log('Tracker module loaded');
            } catch (error) {
                await this.log(`Failed to load tracker module: ${error}`, 'ERROR');
                throw error;
            }
        }

        async loadMIDI() {
            const synth = this.selectedSynth === 'midicube' ? this.midicube : this.tinySynth;
            
            if (!synth) {
                throw new Error(`${this.selectedSynth} not initialized`);
            }
            
            try {
                if (this.selectedSynth === 'midicube' && this.midicube) {
                    // Load MIDI with Midicube
                    await this.midicube.loadMidiData(this.currentFile);
                    this.currentPlayer = 'midicube';
                    await this.log('MIDI loaded with Midicube');
                } else if (this.tinySynth) {
                    // Load MIDI with TinySynth (fallback)
                    const midiArray = Array.from(this.currentFile);
                    this.tinySynth.loadMIDI(midiArray);
                    this.currentPlayer = 'tinysynth';
                    await this.log('MIDI loaded with TinySynth');
                } else {
                    throw new Error('No MIDI synth available');
                }
            } catch (error) {
                await this.log(`Failed to load MIDI: ${error}`, 'ERROR');
                throw error;
            }
        }

        async play() {
            if (this.isPlaying) return;
            
            try {
                // Resume audio context if suspended
                if (this.audioContext.state === 'suspended') {
                    await this.audioContext.resume();
                }
                
                switch(this.currentPlayer) {
                    case 'chiptune':
                        this.playTrackerModule();
                        break;
                    case 'tinysynth':
                        this.playMIDI();
                        break;
                    case 'midicube':
                        this.playMidicube();
                        break;
                    default:
                        throw new Error('No player loaded');
                }
                
                this.isPlaying = true;
                this.startTime = this.audioContext.currentTime - this.pauseTime;
                await this.log('Playback started');
            } catch (error) {
                await this.log(`Playback failed: ${error.message}`, 'ERROR');
                throw error;
            }
        }

        playTrackerModule() {
            if (!this.chiptunePlayer) {
                throw new Error('ChiptuneJS not available');
            }
            
            // Create the audio processing node
            this.chiptunePlayer.play();
            
            // Start progress monitoring
            this.startProgressMonitoring();
        }

        playMIDI() {
            if (!this.tinySynth) {
                throw new Error('TinySynth not available');
            }
            
            this.tinySynth.playMIDI();
            this.startProgressMonitoring();
        }

        playMidicube() {
            if (!this.midicube) {
                throw new Error('Midicube not available');
            }
            
            this.midicube.play();
            this.startProgressMonitoring();
        }

        pause() {
            if (!this.isPlaying) return;
            
            try {
                switch(this.currentPlayer) {
                    case 'chiptune':
                        if (this.chiptunePlayer) {
                            this.chiptunePlayer.stop();
                        }
                        break;
                    case 'tinysynth':
                        if (this.tinySynth) {
                            this.tinySynth.pause();
                        }
                        break;
                    case 'midicube':
                        if (this.midicube) {
                            this.midicube.pause();
                        }
                        break;
                }
                
                this.pauseTime = this.audioContext.currentTime - this.startTime;
                this.isPlaying = false;
                this.stopProgressMonitoring();
                this.log('Playback paused');
            } catch (error) {
                this.log(`Failed to pause: ${error.message}`, 'ERROR');
            }
        }

        stop() {
            try {
                switch(this.currentPlayer) {
                    case 'chiptune':
                        if (this.chiptunePlayer && this.chiptunePlayer.currentPlayingNode) {
                            this.chiptunePlayer.stop();
                        }
                        break;
                    case 'tinysynth':
                        if (this.tinySynth) {
                            this.tinySynth.stop();
                        }
                        break;
                    case 'midicube':
                        if (this.midicube) {
                            this.midicube.stop();
                        }
                        break;
                }
                
                this.isPlaying = false;
                this.startTime = 0;
                this.pauseTime = 0;
                this.stopProgressMonitoring();
                this.log('Playback stopped');
            } catch (error) {
                this.log(`Failed to stop: ${error.message}`, 'ERROR');
            }
        }

        setVolume(value) {
            this.volume = Math.max(0, Math.min(1, value));
            
            if (this.chiptunePlayer) {
                this.chiptunePlayer.setVolume(this.volume);
            }
            if (this.tinySynth) {
                this.tinySynth.setMasterVol(Math.floor(this.volume * 127));
            }
            if (this.midicube) {
                this.midicube.setVolume(this.volume);
            }
            
            this.log(`Volume set to: ${Math.round(this.volume * 100)}%`);
        }

        startProgressMonitoring() {
            this.stopProgressMonitoring();
            
            this.progressInterval = setInterval(() => {
                if (this.isPlaying) {
                    const progress = this.getProgress();
                    if (window.updateProgress) {
                        window.updateProgress(progress.current, progress.total);
                    }
                }
            }, 100);
        }

        stopProgressMonitoring() {
            if (this.progressInterval) {
                clearInterval(this.progressInterval);
                this.progressInterval = null;
            }
        }

        getProgress() {
            let current = 0;
            let total = 0;
            
            switch(this.currentPlayer) {
                case 'chiptune':
                    if (this.chiptunePlayer) {
                        current = this.chiptunePlayer.getCurrentTime() || 0;
                        total = this.chiptunePlayer.getDuration() || 0;
                    }
                    break;
                case 'tinysynth':
                    if (this.tinySynth) {
                        current = this.tinySynth.getPlayTime() || 0;
                        total = this.tinySynth.getTotalTime() || 0;
                    }
                    break;
                case 'midicube':
                    if (this.midicube) {
                        current = this.midicube.getCurrentTime() || 0;
                        total = this.midicube.getDuration() || 0;
                    }
                    break;
            }
            
            return { current, total };
        }

        checkSystemStatus() {
            const status = [];
            status.push(`Audio Context: ${this.systemStatus.audioContext ? '✔' : '✗'}`);
            status.push(`ChiptuneJS: ${this.systemStatus.chiptune ? '✔' : '✗'}`);
            status.push(`TinySynth: ${this.systemStatus.tinysynth ? '✔' : '✗'}`);
            status.push(`Midicube: ${this.systemStatus.midicube ? '✔' : '✗'}`);
            status.push(`OpenMPT: ${this.systemStatus.openmpt ? '✔' : '✗'}`);
            
            this.log('System Status:\n' + status.join('\n'));
            return this.systemStatus;
        }

        async log(message, level = 'INFO') {
            const timestamp = new Date().toLocaleTimeString();
            const logMessage = `[${timestamp}] ${level}: ${message}`;
            console.log(logMessage);
            
            // Send to server logging
            if (window.serverLog) {
                window.serverLog(message, level);
            }
        }
    }

    // Export to global scope
    window.FallbackAudioEngine = FallbackAudioEngine;
    
})(window);