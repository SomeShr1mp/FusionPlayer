// SpessaSynth Wrapper - Provides unified interface for SpessaSynth integration
// This wrapper allows SpessaSynth to work alongside TinySynth with a compatible API

class SpessaSynthWrapper {
    constructor() {
        this.synthesizer = null;
        this.audioContext = null;
        this.audioNode = null;
        this.isReady = false;
        this.currentSoundFont = null;
        this.midiSequencer = null;
        this.volume = 0.5;
        this.currentMidiData = null;
        this.startTime = 0;
        this.pauseTime = 0;
        this.isPlaying = false;
        this.isPaused = false;
        
        console.log('🎹 SpessaSynthWrapper initialized');
    }
    
    async initialize(audioContext) {
        try {
            // Check if SpessaSynth is available
            if (typeof SpessaSynth === 'undefined') {
                // Try alternative naming conventions
                if (typeof spessasynth !== 'undefined') {
                    window.SpessaSynth = spessasynth;
                } else {
                    throw new Error('SpessaSynth library not loaded');
                }
            }
            
            this.audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
            
            // Initialize SpessaSynth based on its API structure
            // SpessaSynth might have different initialization patterns
            if (SpessaSynth.Synthesizer) {
                // Newer API structure
                this.audioNode = this.audioContext.createGain();
                this.audioNode.gain.value = this.volume;
                this.audioNode.connect(this.audioContext.destination);
                
                this.synthesizer = new SpessaSynth.Synthesizer(
                    this.audioNode,
                    {
                        voiceCount: 64,
                        sampleRate: this.audioContext.sampleRate,
                        reverbEnabled: false
                    }
                );
            } else if (SpessaSynth.SoundFont2Synth) {
                // Alternative API structure
                this.synthesizer = new SpessaSynth.SoundFont2Synth();
                await this.synthesizer.init(this.audioContext);
                
                this.audioNode = this.synthesizer.getAudioNode();
                if (this.audioNode) {
                    this.audioNode.connect(this.audioContext.destination);
                }
            } else {
                // Fallback initialization
                this.synthesizer = new SpessaSynth();
                if (this.synthesizer.init) {
                    await this.synthesizer.init(this.audioContext);
                }
            }
            
            // Try to load default SoundFont
            await this.loadDefaultSoundFont();
            
            this.isReady = true;
            console.log('✅ SpessaSynth initialized successfully');
            return true;
            
        } catch (error) {
            console.error('SpessaSynth initialization failed:', error);
            this.isReady = false;
            throw error;
        }
    }
    
    async loadDefaultSoundFont() {
        try {
            // Try to load default SoundFont
            const response = await fetch('/soundfonts/default.sf2');
            if (response.ok) {
                const soundFontBuffer = await response.arrayBuffer();
                await this.loadSoundFont(soundFontBuffer);
                console.log('✅ Default SoundFont loaded');
            } else {
                console.warn('No default SoundFont found, will use built-in sounds if available');
                // Try to use a minimal built-in soundfont if available
                if (this.synthesizer && this.synthesizer.loadBuiltIn) {
                    await this.synthesizer.loadBuiltIn();
                }
            }
        } catch (error) {
            console.warn('Failed to load default SoundFont:', error);
        }
    }
    
    async loadSoundFont(arrayBuffer) {
        if (!this.synthesizer) {
            throw new Error('Synthesizer not initialized');
        }
        
        try {
            // Different SpessaSynth versions might have different methods
            if (this.synthesizer.loadSoundFont) {
                await this.synthesizer.loadSoundFont(arrayBuffer);
            } else if (this.synthesizer.loadSf2) {
                await this.synthesizer.loadSf2(arrayBuffer);
            } else if (this.synthesizer.setSoundFont) {
                await this.synthesizer.setSoundFont(arrayBuffer);
            } else {
                throw new Error('No SoundFont loading method found');
            }
            
            this.currentSoundFont = 'custom';
            console.log('✅ SoundFont loaded successfully');
            return true;
        } catch (error) {
            console.error('Failed to load SoundFont:', error);
            throw error;
        }
    }
    
    async loadMIDI(midiData) {
        if (!this.synthesizer) {
            throw new Error('Synthesizer not initialized');
        }
        
        try {
            // Store MIDI data
            if (midiData instanceof ArrayBuffer) {
                this.currentMidiData = new Uint8Array(midiData);
            } else if (midiData instanceof Uint8Array) {
                this.currentMidiData = midiData;
            } else {
                throw new Error('Invalid MIDI data format');
            }
            
            // Parse MIDI if we have a sequencer
            if (SpessaSynth.Sequencer) {
                this.midiSequencer = new SpessaSynth.Sequencer(this.currentMidiData, this.synthesizer);
            } else if (this.synthesizer.loadMIDI) {
                await this.synthesizer.loadMIDI(this.currentMidiData);
            } else if (this.synthesizer.parseMIDI) {
                await this.synthesizer.parseMIDI(this.currentMidiData);
            }
            
            return true;
        } catch (error) {
            console.error('Failed to load MIDI:', error);
            throw error;
        }
    }
    
    async loadMIDIFromUrl(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to fetch MIDI: ${response.status}`);
            }
            const midiData = await response.arrayBuffer();
            return await this.loadMIDI(midiData);
        } catch (error) {
            console.error('Failed to load MIDI from URL:', error);
            throw error;
        }
    }
    
    play() {
        try {
            if (this.midiSequencer) {
                this.midiSequencer.play();
                this.isPlaying = true;
                this.isPaused = false;
            } else if (this.synthesizer && this.synthesizer.play) {
                this.synthesizer.play();
                this.isPlaying = true;
                this.isPaused = false;
            } else if (this.synthesizer && this.synthesizer.start) {
                this.synthesizer.start();
                this.isPlaying = true;
                this.isPaused = false;
            } else {
                console.warn('No play method available');
                return false;
            }
            
            this.startTime = this.audioContext.currentTime - this.pauseTime;
            return true;
        } catch (error) {
            console.error('Play error:', error);
            return false;
        }
    }
    
    pause() {
        try {
            if (this.midiSequencer && this.midiSequencer.pause) {
                this.midiSequencer.pause();
                this.isPaused = true;
            } else if (this.synthesizer && this.synthesizer.pause) {
                this.synthesizer.pause();
                this.isPaused = true;
            } else {
                // Fallback: stop all notes
                this.stopAllNotes();
                this.isPaused = true;
            }
            
            this.pauseTime = this.audioContext.currentTime - this.startTime;
            return true;
        } catch (error) {
            console.error('Pause error:', error);
            return false;
        }
    }
    
    stop() {
        try {
            if (this.midiSequencer && this.midiSequencer.stop) {
                this.midiSequencer.stop();
            } else if (this.synthesizer && this.synthesizer.stop) {
                this.synthesizer.stop();
            }
            
            // Ensure all notes are stopped
            this.stopAllNotes();
            
            this.isPlaying = false;
            this.isPaused = false;
            this.startTime = 0;
            this.pauseTime = 0;
            
            return true;
        } catch (error) {
            console.error('Stop error:', error);
            return false;
        }
    }
    
    stopAllNotes() {
        if (!this.synthesizer) return;
        
        // Try various methods to stop all notes
        for (let channel = 0; channel < 16; channel++) {
            // All notes off
            if (this.synthesizer.allNotesOff) {
                this.synthesizer.allNotesOff(channel);
            } else if (this.synthesizer.controlChange) {
                this.synthesizer.controlChange(channel, 123, 0);
            }
            
            // All sound off
            if (this.synthesizer.allSoundOff) {
                this.synthesizer.allSoundOff(channel);
            } else if (this.synthesizer.controlChange) {
                this.synthesizer.controlChange(channel, 120, 0);
            }
            
            // Send MIDI messages directly if possible
            if (this.synthesizer.sendMessage) {
                this.synthesizer.sendMessage([0xB0 | channel, 123, 0]); // All notes off
                this.synthesizer.sendMessage([0xB0 | channel, 120, 0]); // All sound off
            }
        }
    }
    
    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
        
        if (this.audioNode) {
            this.audioNode.gain.value = this.volume;
        } else if (this.synthesizer && this.synthesizer.setVolume) {
            this.synthesizer.setVolume(this.volume);
        } else if (this.synthesizer && this.synthesizer.setMasterVolume) {
            this.synthesizer.setMasterVolume(Math.floor(this.volume * 127));
        }
    }
    
    getPlayTime() {
        if (this.midiSequencer && this.midiSequencer.currentTime !== undefined) {
            return this.midiSequencer.currentTime;
        } else if (this.synthesizer && this.synthesizer.getCurrentTime) {
            return this.synthesizer.getCurrentTime();
        } else if (this.isPlaying && !this.isPaused) {
            return this.audioContext.currentTime - this.startTime;
        } else if (this.isPaused) {
            return this.pauseTime;
        }
        return 0;
    }
    
    getTotalTime() {
        if (this.midiSequencer && this.midiSequencer.duration !== undefined) {
            return this.midiSequencer.duration;
        } else if (this.synthesizer && this.synthesizer.getDuration) {
            return this.synthesizer.getDuration();
        } else if (this.synthesizer && this.synthesizer.totalTime) {
            return this.synthesizer.totalTime;
        }
        return 0;
    }
    
    setPlayTime(time) {
        if (this.midiSequencer && this.midiSequencer.seek) {
            this.midiSequencer.seek(time);
        } else if (this.synthesizer && this.synthesizer.seek) {
            this.synthesizer.seek(time);
        } else if (this.synthesizer && this.synthesizer.setCurrentTime) {
            this.synthesizer.setCurrentTime(time);
        }
        
        this.pauseTime = time;
        if (this.isPlaying && !this.isPaused) {
            this.startTime = this.audioContext.currentTime - time;
        }
    }
    
    // TinySynth compatibility method - send raw MIDI messages
    send(data, timestamp) {
        if (!this.synthesizer) return;
        
        const status = data[0] & 0xF0;
        const channel = data[0] & 0x0F;
        
        try {
            switch (status) {
                case 0x80: // Note Off
                    if (this.synthesizer.noteOff) {
                        this.synthesizer.noteOff(channel, data[1], data[2]);
                    }
                    break;
                case 0x90: // Note On
                    if (data[2] > 0) {
                        if (this.synthesizer.noteOn) {
                            this.synthesizer.noteOn(channel, data[1], data[2]);
                        }
                    } else {
                        // Velocity 0 means note off
                        if (this.synthesizer.noteOff) {
                            this.synthesizer.noteOff(channel, data[1], 64);
                        }
                    }
                    break;
                case 0xB0: // Control Change
                    if (this.synthesizer.controlChange) {
                        this.synthesizer.controlChange(channel, data[1], data[2]);
                    } else if (this.synthesizer.controllerChange) {
                        this.synthesizer.controllerChange(channel, data[1], data[2]);
                    }
                    break;
                case 0xC0: // Program Change
                    if (this.synthesizer.programChange) {
                        this.synthesizer.programChange(channel, data[1]);
                    }
                    break;
                case 0xD0: // Channel Pressure
                    if (this.synthesizer.channelPressure) {
                        this.synthesizer.channelPressure(channel, data[1]);
                    }
                    break;
                case 0xE0: // Pitch Bend
                    const bend = (data[2] << 7) | data[1];
                    if (this.synthesizer.pitchBend) {
                        this.synthesizer.pitchBend(channel, bend);
                    } else if (this.synthesizer.pitchWheel) {
                        this.synthesizer.pitchWheel(channel, bend);
                    }
                    break;
            }
            
            // If synthesizer has a direct send method, use it
            if (this.synthesizer.sendMessage) {
                this.synthesizer.sendMessage(data);
            }
        } catch (error) {
            console.warn('SpessaSynth send error:', error);
        }
    }
    
    getAudioContext() {
        return this.audioContext;
    }
    
    // Get current synthesizer info
    getInfo() {
        return {
            name: 'SpessaSynth',
            version: '1.0',
            soundFont: this.currentSoundFont || 'none',
            voiceCount: this.synthesizer?.voiceCount || 64,
            isReady: this.isReady,
            features: ['SoundFont SF2/SF3', 'High Quality', 'Full GM Support']
        };
    }
    
    // Check if SpessaSynth is properly loaded
    static isAvailable() {
        return typeof SpessaSynth !== 'undefined' || 
               typeof spessasynth !== 'undefined' ||
               typeof SPESSASYNTH !== 'undefined';
    }
}

// Make globally available
window.SpessaSynthWrapper = SpessaSynthWrapper;

// Auto-detect and alias SpessaSynth if needed
if (typeof spessasynth !== 'undefined' && typeof SpessaSynth === 'undefined') {
    window.SpessaSynth = spessasynth;
}

console.log('🎹 SpessaSynthWrapper loaded - Available:', SpessaSynthWrapper.isAvailable());
