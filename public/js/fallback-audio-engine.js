// Fallback AudioEngine - Works without AudioWorklet
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
        this.synthesizerReady = false;
        
        this.uiController = null;
        this.progressInterval = null;
        this.midiPlaybackContext = null;
        
        console.log('🎵 Using Fallback Audio Engine (no AudioWorklet)');
    }
    
    setUIController(uiController) {
        this.uiController = uiController;
    }
    
    async initialize() {
        try {
            // Initialize Web Audio Context
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.gainNode = this.audioContext.createGain();
            this.gainNode.connect(this.audioContext.destination);
            this.gainNode.gain.value = this.volume;
            
            this.updateStatus('Audio context initialized (fallback mode)');
            
            // Skip AudioWorklet initialization
            await this.initializeOpenMPT();
            await this.initializeSynthesizer();
            await this.loadSoundFont();
            
            // Enable audio context on user interaction
            this.setupUserActivation();
            
            this.updateStatus('Fallback audio engine ready');
            return true;
            
        } catch (error) {
            this.updateStatus('Audio engine initialization failed: ' + error.message);
            console.error('FallbackAudioEngine initialization error:', error);
            throw error;
        }
    }
    
    async initializeOpenMPT() {
        try {
            this.updateStatus('Waiting for OpenMPT/chiptune2.js...');
            
            // Wait for libraries to load
            let attempts = 0;
            while (typeof ChiptuneJsConfig === 'undefined' && typeof Module === 'undefined' && attempts < 50) {
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
            }
            
            if (typeof ChiptuneJsConfig !== 'undefined' && typeof ChiptuneJsPlayer !== 'undefined') {
                try {
                    this.chiptunePlayer = new ChiptuneJsPlayer(new ChiptuneJsConfig(-1, this.audioContext));
                    this.updateStatus('chiptune2.js loaded successfully');
                } catch (chipErr) {
                    console.error('ChiptuneJS initialization error:', chipErr);
                    this.updateStatus('ChiptuneJS failed to initialize');
                }
            } else {
                this.updateStatus('ChiptuneJS libraries not available');
            }
            
        } catch (error) {
            console.error('OpenMPT initialization error:', error);
            this.updateStatus('OpenMPT initialization failed: ' + error.message);
        }
    }
    
    async initializeSynthesizer() {
        try {
            this.updateStatus('Initializing synthesizer...');
            
            // Try WebAudioTinySynth first for fallback mode
            if (typeof WebAudioTinySynth !== 'undefined') {
                this.synthesizer = new WebAudioTinySynth();
                this.synthesizerReady = true;
                this.updateStatus('WebAudioTinySynth initialized');
                return;
            }
            
            // Try LibFluidSynth
            if (typeof LibFluidSynth !== 'undefined') {
                this.synthesizer = new LibFluidSynth();
                this.synthesizerReady = true;
                this.updateStatus('LibFluidSynth initialized');
                return;
            }
            
            // Try JSSynth as last resort
            if (typeof JSSynth !== 'undefined') {
                this.synthesizer = new JSSynth();
                this.synthesizerReady = true;
                this.updateStatus('JSSynth initialized');
                return;
            }
            
            // Create basic synthesizer if nothing else is available
            this.synthesizer = this.createBasicSynthesizer();
            this.synthesizerReady = true;
            this.updateStatus('Basic synthesizer created');
            
        } catch (error) {
            console.error('Synthesizer initialization error:', error);
            this.updateStatus('Synthesizer initialization failed: ' + error.message);
            this.synthesizer = this.createBasicSynthesizer();
            this.synthesizerReady = true;
        }
    }
    
    createBasicSynthesizer() {
        const oscillators = new Map();
        const gainNodes = new Map();
        
        return {
            send: (midiData) => {
                const [status, note, velocity] = midiData;
                const command = status & 0xF0;
                
                if (command === 0x90 && velocity > 0) {
                    this.playNote(note, velocity, oscillators, gainNodes);
                } else if (command === 0x80 || (command === 0x90 && velocity === 0)) {
                    this.stopNote(note, oscillators, gainNodes);
                }
            },
            stopMIDI: () => {
                oscillators.forEach(osc => {
                    try { osc.stop(); } catch (e) {}
                });
                oscillators.clear();
                gainNodes.clear();
            }
        };
    }
    
    /**
     * Parse MIDI file to extract duration and events
     * @param {Uint8Array} midiData - Raw MIDI file data
     * @returns {Object} Parsed MIDI data with duration, events, etc.
     */
    parseMidiFile(midiData) {
        try {
            // Basic MIDI file parsing
            const view = new DataView(midiData.buffer, midiData.byteOffset, midiData.byteLength);
            let pos = 0;
            
            // Check MIDI header
            const headerChunk = String.fromCharCode(...midiData.slice(0, 4));
            if (headerChunk !== 'MThd') {
                throw new Error('Invalid MIDI file format');
            }
            
            pos += 8; // Skip header chunk ID and length
            const format = view.getUint16(pos, false); pos += 2;
            const numTracks = view.getUint16(pos, false); pos += 2;
            const division = view.getUint16(pos, false); pos += 2;
            
            console.log(`MIDI Format: ${format}, Tracks: ${numTracks}, Division: ${division}`);
            
            // Calculate approximate duration
            let totalTicks = 0;
            let tempo = 500000; // Default tempo (120 BPM)
            let ticksPerQuarter = division;
            
            // Parse tracks to find the longest one and extract tempo
            for (let track = 0; track < numTracks && pos < midiData.length - 8; track++) {
                const trackHeader = String.fromCharCode(...midiData.slice(pos, pos + 4));
                pos += 4;
                
                if (trackHeader !== 'MTrk') {
                    console.warn(`Invalid track header: ${trackHeader}`);
                    break;
                }
                
                const trackLength = view.getUint32(pos, false); pos += 4;
                const trackStart = pos;
                const trackEnd = Math.min(pos + trackLength, midiData.length);
                
                let trackTime = 0;
                let runningStatus = 0;
                
                while (pos < trackEnd) {
                    try {
                        // Read variable-length delta time
                        let deltaTime = 0;
                        let byte;
                        do {
                            if (pos >= trackEnd) break;
                            byte = midiData[pos++];
                            deltaTime = (deltaTime << 7) | (byte & 0x7F);
                        } while (byte & 0x80);
                        
                        trackTime += deltaTime;
                        
                        if (pos >= trackEnd) break;
                        let status = midiData[pos];
                        
                        // Handle running status
                        if (status < 0x80) {
                            status = runningStatus;
                            pos--; // Step back since we didn't consume a status byte
                        } else {
                            runningStatus = status;
                        }
                        pos++;
                        
                        if (status >= 0xF0) {
                            // System exclusive or meta event
                            if (status === 0xFF && pos < trackEnd) {
                                const metaType = midiData[pos++];
                                let length = 0;
                                
                                // Read variable-length quantity for meta event length
                                do {
                                    if (pos >= trackEnd) break;
                                    byte = midiData[pos++];
                                    length = (length << 7) | (byte & 0x7F);
                                } while (byte & 0x80);
                                
                                // Check for tempo meta event
                                if (metaType === 0x51 && length === 3) {
                                    // Tempo change event
                                    if (pos + 2 < trackEnd) {
                                        tempo = (midiData[pos] << 16) | (midiData[pos + 1] << 8) | midiData[pos + 2];
                                        console.log(`Found tempo: ${tempo} microseconds per quarter note (${Math.round(60000000 / tempo)} BPM)`);
                                    }
                                }
                                
                                pos += length;
                            } else {
                                // Skip other system events
                                pos += 2;
                            }
                        } else {
                            // MIDI event - skip data bytes
                            const eventType = status & 0xF0;
                            if (eventType === 0xC0 || eventType === 0xD0) {
                                // Program change or channel pressure (1 data byte)
                                pos += 1;
                            } else {
                                // Most other events (2 data bytes)
                                pos += 2;
                            }
                        }
                    } catch (parseError) {
                        console.warn('MIDI parsing error in track:', parseError);
                        break;
                    }
                }
                
                totalTicks = Math.max(totalTicks, trackTime);
                
                // Ensure we're at the correct position for the next track
                pos = trackStart + trackLength;
            }
            
            // Calculate duration in seconds
            const secondsPerTick = (tempo / 1000000) / ticksPerQuarter;
            const duration = Math.max(30, Math.min(600, totalTicks * secondsPerTick)); // Clamp between 30 seconds and 10 minutes
            
            console.log(`MIDI Analysis: ${totalTicks} ticks, ${secondsPerTick.toFixed(6)} seconds/tick, ${duration.toFixed(1)} seconds total`);
            
            return {
                format,
                numTracks,
                division: ticksPerQuarter,
                tempo,
                totalTicks,
                duration,
                events: [], // We'll populate this if needed
                ticksPerQuarter
            };
            
        } catch (error) {
            console.error('MIDI parsing error:', error);
            // Fallback to reasonable default
            return {
                format: 1,
                numTracks: 1,
                division: 480,
                tempo: 500000,
                totalTicks: 38400, // 2 minutes at 120 BPM
                duration: 120,
                events: [],
                ticksPerQuarter: 480
            };
        }
    }
    
    playNote(note, velocity, oscillators, gainNodes) {
        try {
            this.stopNote(note, oscillators, gainNodes);
            
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();
            
            const frequency = 440 * Math.pow(2, (note - 69) / 12);
            osc.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
            osc.type = 'sawtooth';
            
            const volume = (velocity / 127) * 0.1;
            gain.gain.setValueAtTime(volume, this.audioContext.currentTime);
            
            osc.connect(gain);
            gain.connect(this.gainNode);
            osc.start();
            
            oscillators.set(note, osc);
            gainNodes.set(note, gain);
            
        } catch (error) {
            console.error('Error playing note:', error);
        }
    }
    
    stopNote(note, oscillators, gainNodes) {
        try {
            const osc = oscillators.get(note);
            const gain = gainNodes.get(note);
            
            if (osc && gain) {
                gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.1);
                osc.stop(this.audioContext.currentTime + 0.1);
                oscillators.delete(note);
                gainNodes.delete(note);
            }
        } catch (error) {
            console.error('Error stopping note:', error);
        }
    }
    
    async loadSoundFont() {
        // Skip SoundFont loading for TinySynth as it has built-in sounds
        if (this.synthesizer instanceof WebAudioTinySynth) {
            this.updateStatus('TinySynth ready with built-in sounds');
            return;
        }
        
        // For other synthesizers, try to load SoundFont
        try {
            this.updateStatus('Loading SoundFont...');
            
            const response = await fetch('/soundfonts/default.sf2');
            if (!response.ok) {
                throw new Error('SoundFont not found');
            }
            
            const soundFontData = await response.arrayBuffer();
            
            if (this.synthesizer && this.synthesizer.loadSoundFont) {
                await this.synthesizer.loadSoundFont(new Uint8Array(soundFontData));
                this.updateStatus('SoundFont loaded successfully');
            } else {
                this.updateStatus('Synthesizer ready with built-in sounds');
            }
            
        } catch (error) {
            this.updateStatus('SoundFont loading failed, using built-in sounds: ' + error.message);
        }
    }
    
    setupUserActivation() {
        const activateAudio = async () => {
            if (this.audioContext && this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
                this.updateStatus('Audio context activated');
            }
        };
        
        document.addEventListener('click', activateAudio, { once: true });
        document.addEventListener('touchstart', activateAudio, { once: true });
    }
    
    async playTrack(trackData) {
        if (!trackData) {
            throw new Error('No track data provided');
        }
        
        this.stop(); // Stop any current playback
        
        const trackUrl = `/music/${trackData.filename}`;
        this.updateStatus(`Loading ${trackData.filename}...`);
        
        try {
            if (trackData.type === 'tracker') {
                await this.playTrackerModule(trackUrl);
            } else if (trackData.type === 'midi') {
                await this.playMidiFile(trackUrl, trackData);
            } else {
                throw new Error('Unsupported file type');
            }
        } catch (error) {
            this.updateStatus(`Playback failed: ${error.message}`);
            throw error;
        }
    }
    
    async playTrackerModule(url) {
        try {
            if (this.chiptunePlayer) {
                await this.playWithChiptune2(url);
            } else {
                throw new Error('No tracker player available');
            }
        } catch (error) {
            throw new Error('Failed to load tracker module: ' + error.message);
        }
    }
    
    async playWithChiptune2(url) {
        try {
            // Download the file first
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
            }
            const arrayBuffer = await response.arrayBuffer();
            
            // Create a blob URL for ChiptuneJS
            const blob = new Blob([arrayBuffer], { type: 'application/octet-stream' });
            const blobUrl = URL.createObjectURL(blob);
            
            const player = this.chiptunePlayer;
            
            if (player && typeof player.load === 'function') {
                await new Promise((resolve, reject) => {
                    player.load(blobUrl, (response) => {
                        // Clean up blob URL
                        URL.revokeObjectURL(blobUrl);
                        
                        console.log('ChiptuneJS callback response type:', typeof response);
                        console.log('ChiptuneJS callback response:', response);
                        
                        // ChiptuneJS callback signature is callback(result) on success
                        // If we get an ArrayBuffer, that means SUCCESS!
                        if (response instanceof ArrayBuffer) {
                            console.log('ChiptuneJS loaded successfully!');
                            try {
                                player.play();
                                console.log('ChiptuneJS play() called successfully');
                                resolve();
                            } catch (playError) {
                                reject(new Error(`ChiptuneJS play error: ${playError.message}`));
                            }
                        } else if (response && typeof response === 'object' && response.type === 'onxhr') {
                            // This is a ChiptuneJS error object
                            reject(new Error('ChiptuneJS XHR error'));
                        } else if (response === null || response === undefined) {
                            // Some versions might pass null/undefined on success before calling play
                            try {
                                player.play();
                                console.log('ChiptuneJS play() called after null response');
                                resolve();
                            } catch (playError) {
                                reject(new Error(`ChiptuneJS play error: ${playError.message}`));
                            }
                        } else {
                            // Unknown response type - log it for debugging
                            console.warn('Unknown ChiptuneJS response:', response);
                            reject(new Error(`ChiptuneJS unknown response: ${response}`));
                        }
                    });
                });
                
                this.isPlaying = true;
                this.updateStatus('Playing tracker module with chiptune2.js');
                this.startChiptune2Progress();
                
            } else {
                throw new Error('Chiptune2.js player not properly initialized');
            }
        } catch (error) {
            console.error('Chiptune2.js failed:', error);
            throw error;
        }
    }
    
    startChiptune2Progress() {
        let startTime = Date.now();
        
        this.progressInterval = setInterval(() => {
            if (!this.isPlaying) {
                clearInterval(this.progressInterval);
                return;
            }
            
            // Get current time from chiptune2.js if available
            if (this.chiptunePlayer && typeof this.chiptunePlayer.getCurrentTime === 'function') {
                this.currentTime = this.chiptunePlayer.getCurrentTime();
            } else {
                // Fallback time tracking
                this.currentTime = (Date.now() - startTime) / 1000;
            }
            
            if (this.uiController) {
                this.uiController.updateProgress(this.currentTime, this.duration);
            }
            
            // Get duration from chiptune2.js if available
            if (this.chiptunePlayer && typeof this.chiptunePlayer.getDuration === 'function') {
                this.duration = this.chiptunePlayer.getDuration();
            }
            
            // Check if playback should end
            if (this.currentTime >= this.duration && this.duration > 0) {
                this.isPlaying = false;
                if (this.uiController) {
                    this.uiController.updateControls(false, false);
                    this.uiController.nextTrack();
                }
                clearInterval(this.progressInterval);
            }
        }, 100);
    }
    
    async playMidiFile(url, trackData) {
        try {
            const response = await fetch(url);
            const midiData = new Uint8Array(await response.arrayBuffer());
            
            if (this.synthesizer && this.synthesizerReady) {
                await this.playMidiWithTinySynth(midiData);
            } else {
                throw new Error('MIDI synthesizer not ready');
            }
            
            this.isPlaying = true;
            this.updateStatus(`Playing MIDI: ${trackData.filename}`);
            
        } catch (error) {
            throw new Error('Failed to load MIDI file: ' + error.message);
        }
    }
    
    async playMidiWithTinySynth(midiData) {
        try {
            // Parse MIDI to get duration
            const midiFile = this.parseMidiFile(midiData);
            this.duration = midiFile.duration;
            
            console.log(`MIDI duration detected: ${this.duration} seconds`);
            
            // Create a blob URL for the MIDI data
            const blob = new Blob([midiData], { type: 'audio/midi' });
            const url = URL.createObjectURL(blob);
            
            // Load and play with TinySynth
            if (this.synthesizer.loadMIDIUrl) {
                await this.synthesizer.loadMIDIUrl(url);
                this.synthesizer.playMIDI();
                
                this.startTinySynthProgress();
            } else if (this.synthesizer.loadMIDI) {
                this.synthesizer.loadMIDI(midiData);
                if (this.synthesizer.playMIDI) {
                    this.synthesizer.playMIDI();
                } else if (this.synthesizer.play) {
                    this.synthesizer.play();
                }
                
                this.startTinySynthProgress();
            } else {
                throw new Error('TinySynth MIDI loading not available');
            }
            
            // Clean up blob URL
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            
        } catch (error) {
            console.error('TinySynth MIDI playback failed:', error);
            throw error;
        }
    }
    
    startTinySynthProgress() {
        let startTime = Date.now();
        
        this.progressInterval = setInterval(() => {
            if (!this.isPlaying) {
                clearInterval(this.progressInterval);
                return;
            }
            
            // Simple time tracking for TinySynth
            this.currentTime = (Date.now() - startTime) / 1000;
            
            if (this.uiController) {
                this.uiController.updateProgress(this.currentTime, this.duration);
            }
            
            // Check if playback should end (rough estimate)
            if (this.currentTime >= this.duration && this.duration > 0) {
                this.isPlaying = false;
                if (this.uiController) {
                    this.uiController.updateControls(false, false);
                    this.uiController.nextTrack();
                }
                clearInterval(this.progressInterval);
            }
        }, 100);
    }
    
    pause() {
        if (this.isPlaying && !this.isPaused) {
            this.isPaused = true;
            
            if (this.chiptunePlayer && this.chiptunePlayer.pause) {
                this.chiptunePlayer.pause();
            }
            
            if (this.progressInterval) {
                clearInterval(this.progressInterval);
                this.progressInterval = null;
            }
            
            this.updateStatus('Playback paused');
        }
    }
    
    resume() {
        if (this.isPaused) {
            this.isPaused = false;
            
            if (this.chiptunePlayer && this.chiptunePlayer.play) {
                this.chiptunePlayer.play();
            }
            
            // Restart progress tracking
            if (this.isPlaying) {
                this.startChiptune2Progress();
            }
            
            this.updateStatus('Playback resumed');
        }
    }
    
    stop() {
        this.isPlaying = false;
        this.isPaused = false;
        this.currentTime = 0;
        
        // Clear progress tracking
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
        }
        
        // Stop chiptune2.js playback
        if (this.chiptunePlayer && this.chiptunePlayer.stop) {
            this.chiptunePlayer.stop();
        }
        
        // Stop synthesizer
        if (this.synthesizer) {
            if (this.synthesizer.stopMIDI) {
                this.synthesizer.stopMIDI();
            }
            // Send all notes off for MIDI
            if (this.synthesizer.send) {
                for (let channel = 0; channel < 16; channel++) {
                    this.synthesizer.send([0xB0 | channel, 123, 0], 0); // All notes off
                    this.synthesizer.send([0xB0 | channel, 120, 0], 0); // All sound off
                }
            }
        }
        
        this.updateStatus('Playback stopped');
    }
    
    seek(time) {
        // Simplified seeking - restart from position
        if (this.isPlaying) {
            console.log('Seeking to', time, 'seconds (simplified implementation)');
            this.currentTime = Math.max(0, time);
        }
    }
    
    setVolume(level) {
        this.volume = Math.max(0, Math.min(1, level));
        if (this.gainNode) {
            this.gainNode.gain.value = this.volume;
        }
        
        // Set volume on synthesizer if supported
        if (this.synthesizer && this.synthesizer.setMasterVolume) {
            this.synthesizer.setMasterVolume(this.volume);
        }
    }
    
    updateStatus(message) {
        if (this.uiController) {
            this.uiController.updateSystemStatus(message);
        } else {
            console.log('FallbackAudioEngine:', message);
        }
    }
    
    // Getters for current state
    getCurrentTime() {
        return this.currentTime;
    }
    
    getDuration() {
        return this.duration;
    }
    
    getVolume() {
        return this.volume;
    }
    
    getPlayState() {
        return {
            isPlaying: this.isPlaying,
            isPaused: this.isPaused,
            currentTime: this.currentTime,
            duration: this.duration
        };
    }
}
