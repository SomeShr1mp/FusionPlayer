// AudioWorklet Processor for OpenMPT and JS-Synthesizer - Phase 2 Enhanced
class FusionAudioProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        
        this.bufferSize = 1024;
        this.isPlaying = false;
        this.currentTime = 0;
        this.duration = 0;
        this.engineType = null;
        this.audioEngine = null;
        this.sampleRate = 44100;
        this.volume = 1.0;
        
        // JS-Synthesizer specific properties
        this.synthesizer = null;
        this.midiEvents = [];
        this.currentEventIndex = 0;
        this.startTime = 0;
        this.ticksPerQuarter = 480;
        this.tempo = 500000;
        this.lastUpdateTime = 0;
        
        // Error tracking
        this.errorCount = 0;
        this.maxErrors = 10;
        
        this.port.onmessage = (event) => {
            this.handleMessage(event.data);
        };
        
        // Initialize buffers
        this.audioBuffer = new Float32Array(this.bufferSize * 2);
        this.tempBuffer = new Float32Array(this.bufferSize * 2);
        
        this.log('FusionAudioProcessor initialized');
    }
    
    handleMessage(data) {
        try {
            switch (data.type) {
                case 'init':
                    this.sampleRate = data.sampleRate || 44100;
                    this.log(`Initialized with sample rate: ${this.sampleRate}`);
                    break;
                    
                case 'initSynthesizer':
                    this.initializeSynthesizer(data.synthesizerInstance, data.soundFontData);
                    break;
                    
                case 'setEngine':
                    this.setAudioEngine(data);
                    break;
                    
                case 'play':
                    this.startPlayback();
                    break;
                    
                case 'pause':
                    this.pausePlayback();
                    break;
                    
                case 'stop':
                    this.stopPlayback();
                    break;
                    
                case 'seek':
                    this.seekTo(data.time);
                    break;
                    
                case 'setVolume':
                    this.setVolume(data.volume);
                    break;
                    
                default:
                    this.log(`Unknown message type: ${data.type}`);
            }
        } catch (error) {
            this.handleError('Message handling error', error);
        }
    }
    
    setAudioEngine(data) {
        this.audioEngine = data.engine;
        this.engineType = data.engineType;
        this.duration = data.duration || 0;
        
        if (data.engineType === 'synthesizer') {
            this.midiEvents = data.midiEvents || [];
            this.ticksPerQuarter = data.ticksPerQuarter || 480;
            this.tempo = data.tempo || 500000;
            this.currentEventIndex = 0;
            this.log(`MIDI engine set with ${this.midiEvents.length} events`);
        } else if (data.engineType === 'openmpt') {
            this.log('OpenMPT engine set');
        }
    }
    
    async initializeSynthesizer(synthesizerInstance, soundFontData) {
        try {
            this.synthesizer = synthesizerInstance;
            
            if (soundFontData && this.synthesizer && this.synthesizer.loadSoundFont) {
                await this.synthesizer.loadSoundFont(soundFontData);
            }
            
            this.sendMessage('synthesizerReady', { success: true });
            this.log('Synthesizer initialized successfully');
            
        } catch (error) {
            this.sendMessage('synthesizerReady', { success: false, error: error.message });
            this.handleError('Synthesizer initialization failed', error);
        }
    }
    
    startPlayback() {
        this.isPlaying = true;
        this.startTime = currentTime;
        this.currentTime = 0;
        this.currentEventIndex = 0;
        this.lastUpdateTime = currentTime;
        this.sendMessage('playStateChanged', { playing: true });
        this.log('Playback started');
    }
    
    pausePlayback() {
        this.isPlaying = false;
        this.sendMessage('playStateChanged', { playing: false });
        this.log('Playback paused');
    }
    
    stopPlayback() {
        this.isPlaying = false;
        this.currentTime = 0;
        this.currentEventIndex = 0;
        
        // Stop all active MIDI notes
        if (this.synthesizer && this.engineType === 'synthesizer') {
            this.stopAllNotes();
        }
        
        this.audioEngine = null;
        this.sendMessage('playStateChanged', { playing: false, time: 0 });
        this.log('Playback stopped');
    }
    
    stopAllNotes() {
        try {
            if (this.synthesizer) {
                // Try different methods to stop all notes
                if (this.synthesizer.noteOffAll) {
                    for (let channel = 0; channel < 16; channel++) {
                        this.synthesizer.noteOffAll(channel);
                    }
                } else if (this.synthesizer.send) {
                    // Send all notes off message for all channels
                    for (let channel = 0; channel < 16; channel++) {
                        this.synthesizer.send([0xB0 | channel, 123, 0], 0); // All notes off
                        this.synthesizer.send([0xB0 | channel, 120, 0], 0); // All sound off
                    }
                } else if (this.synthesizer.stopMIDI) {
                    this.synthesizer.stopMIDI();
                }
            }
        } catch (error) {
            this.handleError('Error stopping notes', error);
        }
    }
    
    seekTo(targetTime) {
        this.currentTime = Math.max(0, targetTime);
        
        if (this.audioEngine && this.engineType === 'openmpt') {
            try {
                if (this.audioEngine.set_position_seconds) {
                    this.audioEngine.set_position_seconds(targetTime);
                }
            } catch (error) {
                this.handleError('OpenMPT seek error', error);
            }
        } else if (this.engineType === 'synthesizer') {
            this.seekMIDI(targetTime);
        }
        
        this.log(`Seeked to ${targetTime.toFixed(2)}s`);
    }
    
    seekMIDI(targetTime) {
        if (!this.midiEvents.length || !this.synthesizer) return;
        
        // Stop all current notes
        this.stopAllNotes();
        
        // Find the event index for the target time
        this.currentEventIndex = 0;
        for (let i = 0; i < this.midiEvents.length; i++) {
            if (this.midiEvents[i].time <= targetTime) {
                this.currentEventIndex = i;
            } else {
                break;
            }
        }
        
        // Apply state-changing events up to seek point (program changes, etc.)
        for (let i = 0; i <= this.currentEventIndex; i++) {
            const event = this.midiEvents[i];
            if (event.type !== 'noteOn' && event.type !== 'noteOff') {
                this.processMIDIEvent(event);
            }
        }
        
        this.log(`MIDI seek to ${targetTime.toFixed(2)}s, event index ${this.currentEventIndex}`);
    }
    
    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
        this.log(`Volume set to ${(this.volume * 100).toFixed(0)}%`);
    }
    
    sendMessage(type, data = {}) {
        this.port.postMessage({ type, ...data });
    }
    
    process(inputs, outputs, parameters) {
        const output = outputs[0];
        
        if (!output || output.length < 2) {
            return true;
        }
        
        const leftChannel = output[0];
        const rightChannel = output[1];
        const frameCount = leftChannel.length;
        
        // Clear output buffers
        leftChannel.fill(0);
        rightChannel.fill(0);
        
        if (!this.isPlaying) {
            return true;
        }
        
        try {
            // Process audio based on engine type
            if (this.engineType === 'openmpt' && this.audioEngine) {
                this.processOpenMPT(leftChannel, rightChannel, frameCount);
            } else if (this.engineType === 'synthesizer' && this.synthesizer) {
                this.processSynthesizer(leftChannel, rightChannel, frameCount);
            }
            
            // Apply volume
            if (this.volume !== 1.0) {
                for (let i = 0; i < frameCount; i++) {
                    leftChannel[i] *= this.volume;
                    rightChannel[i] *= this.volume;
                }
            }
            
            // Update time and send progress updates
            this.updateTime(frameCount);
            
        } catch (error) {
            this.handleError('Audio processing error', error);
            
            // If too many errors, stop playback
            if (this.errorCount > this.maxErrors) {
                this.stopPlayback();
                this.sendMessage('error', { message: 'Too many processing errors, playback stopped' });
            }
        }
        
        return true;
    }
    
    processOpenMPT(leftChannel, rightChannel, frameCount) {
        if (!this.audioEngine || !this.audioEngine.read_interleaved_stereo) {
            return;
        }
        
        try {
            const samples = this.audioEngine.read_interleaved_stereo(frameCount);
            
            if (samples && samples.length >= frameCount * 2) {
                for (let i = 0; i < frameCount; i++) {
                    leftChannel[i] = samples[i * 2] || 0;
                    rightChannel[i] = samples[i * 2 + 1] || 0;
                }
                
                // Update time from OpenMPT
                if (this.audioEngine.get_position_seconds) {
                    this.currentTime = this.audioEngine.get_position_seconds();
                }
            } else {
                // No more samples, track ended
                if (this.isPlaying) {
                    this.isPlaying = false;
                    this.sendMessage('trackEnded');
                }
            }
        } catch (error) {
            this.handleError('OpenMPT processing error', error);
        }
    }
    
    processSynthesizer(leftChannel, rightChannel, frameCount) {
        if (!this.synthesizer) {
            return;
        }
        
        try {
            // Process MIDI events for this buffer
            this.processMIDIEvents(frameCount);
            
            // Render audio if synthesizer supports it
            if (this.synthesizer.render) {
                // JS-Synthesizer API
                if (this.audioBuffer.length < frameCount * 2) {
                    this.audioBuffer = new Float32Array(frameCount * 2);
                }
                
                this.synthesizer.render(this.audioBuffer, frameCount);
                
                for (let i = 0; i < frameCount; i++) {
                    leftChannel[i] = this.audioBuffer[i * 2] || 0;
                    rightChannel[i] = this.audioBuffer[i * 2 + 1] || 0;
                }
            }
            // TinySynth and other synthesizers handle audio routing internally
            
        } catch (error) {
            this.handleError('Synthesizer processing error', error);
        }
    }
    
    processMIDIEvents(frameCount) {
        if (!this.midiEvents.length || !this.synthesizer) return;
        
        const bufferDuration = frameCount / this.sampleRate;
        const bufferEndTime = this.currentTime + bufferDuration;
        
        let eventsProcessed = 0;
        
        while (this.currentEventIndex < this.midiEvents.length && eventsProcessed < 100) {
            const event = this.midiEvents[this.currentEventIndex];
            
            if (event.time > bufferEndTime) {
                break;
            }
            
            this.processMIDIEvent(event);
            this.currentEventIndex++;
            eventsProcessed++;
        }
        
        // Check if we've reached the end of the MIDI file
        if (this.currentEventIndex >= this.midiEvents.length && this.isPlaying) {
            // Look for any active notes in the near future
            let hasMoreEvents = false;
            for (let i = this.currentEventIndex; i < Math.min(this.currentEventIndex + 10, this.midiEvents.length); i++) {
                if (this.midiEvents[i] && this.midiEvents[i].time <= bufferEndTime + 1.0) {
                    hasMoreEvents = true;
                    break;
                }
            }
            
            if (!hasMoreEvents && this.currentTime > this.duration - 1.0) {
                this.isPlaying = false;
                this.sendMessage('trackEnded');
            }
        }
    }
    
    processMIDIEvent(event) {
        if (!this.synthesizer || !event) return;
        
        try {
            if (this.synthesizer.send) {
                // TinySynth-style API
                this.processMIDIEventWithSend(event);
            } else {
                // JS-Synthesizer-style API
                this.processMIDIEventWithMethods(event);
            }
        } catch (error) {
            this.handleError(`MIDI event processing error (${event.type})`, error);
        }
    }
    
    processMIDIEventWithSend(event) {
        switch (event.type) {
            case 'noteOn':
                this.synthesizer.send([0x90 | event.channel, event.note, event.velocity], 0);
                break;
                
            case 'noteOff':
                this.synthesizer.send([0x80 | event.channel, event.note, event.velocity || 64], 0);
                break;
                
            case 'programChange':
                this.synthesizer.send([0xC0 | event.channel, event.program], 0);
                break;
                
            case 'controlChange':
                this.synthesizer.send([0xB0 | event.channel, event.controller, event.value], 0);
                break;
                
            case 'pitchBend':
                const pitchValue = event.value + 8192; // Convert to 14-bit value
                this.synthesizer.send([0xE0 | event.channel, pitchValue & 0x7F, (pitchValue >> 7) & 0x7F], 0);
                break;
                
            case 'channelPressure':
                this.synthesizer.send([0xD0 | event.channel, event.pressure], 0);
                break;
        }
    }
    
    processMIDIEventWithMethods(event) {
        switch (event.type) {
            case 'noteOn':
                if (this.synthesizer.noteOn) {
                    this.synthesizer.noteOn(event.channel, event.note, event.velocity);
                }
                break;
                
            case 'noteOff':
                if (this.synthesizer.noteOff) {
                    this.synthesizer.noteOff(event.channel, event.note);
                }
                break;
                
            case 'programChange':
                if (this.synthesizer.programChange) {
                    this.synthesizer.programChange(event.channel, event.program);
                }
                break;
                
            case 'controlChange':
                if (this.synthesizer.controlChange) {
                    this.synthesizer.controlChange(event.channel, event.controller, event.value);
                }
                break;
                
            case 'pitchBend':
                if (this.synthesizer.pitchBend) {
                    this.synthesizer.pitchBend(event.channel, event.value);
                }
                break;
        }
    }
    
    updateTime(frameCount) {
        const deltaTime = frameCount / this.sampleRate;
        this.currentTime += deltaTime;
        
        // Send time updates at reasonable intervals (10 times per second)
        const now = currentTime;
        if (now - this.lastUpdateTime > 0.1) {
            this.sendMessage('timeUpdate', { 
                currentTime: this.currentTime,
                duration: this.duration 
            });
            this.lastUpdateTime = now;
        }
        
        // Check if track ended
        if (this.duration > 0 && this.currentTime >= this.duration) {
            if (this.isPlaying) {
                this.isPlaying = false;
                this.sendMessage('trackEnded');
            }
        }
    }
    
    handleError(message, error) {
        this.errorCount++;
        
        const errorInfo = {
            message: message,
            error: error.message || error,
            count: this.errorCount,
            time: this.currentTime,
            engineType: this.engineType
        };
        
        this.log(`ERROR: ${message} - ${error.message || error}`);
        
        // Send error to main thread if it's significant
        if (this.errorCount <= 3) {
            this.sendMessage('error', errorInfo);
        }
    }
    
    log(message) {
        // Only log in development/debug mode
        if (typeof DEBUG !== 'undefined' && DEBUG) {
            console.log(`[AudioWorklet] ${message}`);
        }
    }
}

registerProcessor('fusion-audio-processor', FusionAudioProcessor);
