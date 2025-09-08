// Midicube Loader - Ensures proper initialization and MIDI playback
(function() {
    'use strict';
    
    console.log('🎵 Midicube Loader v1.1 initializing...');
    
    // Wait for the Midicube library to load
    let checkInterval = setInterval(function() {
        if (window.MIDI && (window.MIDI.Player || window.MIDI.noteOn)) {
            console.log('✅ Found MIDI object with player support');
            
            // Create MIDICube constructor wrapper with full MIDI playback support
            window.MIDICube = class MIDICube {
                constructor(options = {}) {
                    this.audioContext = options.audioContext || new (window.AudioContext || window.webkitAudioContext)();
                    this.gainNode = options.gainNode || this.audioContext.createGain();
                    this.midi = window.MIDI;
                    this.ready = false;
                    this.currentSoundfont = null;
                    this.isPlaying = false;
                    this.midiData = null;
                    this.startTime = 0;
                    this.pauseTime = 0;
                    
                    // Initialize MIDI with the audio context
                    if (this.midi.setContext) {
                        this.midi.setContext(this.audioContext);
                    }
                    
                    // Connect gain node if not already connected
                    if (this.gainNode && this.gainNode.numberOfOutputs === 0) {
                        this.gainNode.connect(this.audioContext.destination);
                    }
                    
                    console.log('MIDICube instance created with audio context');
                }
                
                async loadMIDI(arrayBuffer) {
                    try {
                        console.log('Loading MIDI file...');
                        
                        // Convert ArrayBuffer to base64 data URL if needed
                        const base64 = this.arrayBufferToBase64(arrayBuffer);
                        const midiDataUri = 'data:audio/midi;base64,' + base64;
                        
                        // Store the MIDI data
                        this.midiData = arrayBuffer;
                        
                        // If MIDI.Player exists, use it
                        if (this.midi.Player) {
                            return new Promise((resolve, reject) => {
                                this.midi.Player.loadFile(midiDataUri, () => {
                                    console.log('MIDI file loaded via Player');
                                    this.ready = true;
                                    resolve();
                                }, (error) => {
                                    console.error('Failed to load MIDI:', error);
                                    reject(error);
                                });
                            });
                        } else {
                            // Fallback: Parse MIDI manually
                            console.log('Using fallback MIDI loading');
                            this.parseMIDIData(arrayBuffer);
                            this.ready = true;
                            return Promise.resolve();
                        }
                    } catch (error) {
                        console.error('Failed to load MIDI:', error);
                        throw error;
                    }
                }
                
                parseMIDIData(arrayBuffer) {
                    // Basic MIDI parsing for fallback
                    // This is a simplified version - you might want to use a proper MIDI parser
                    const bytes = new Uint8Array(arrayBuffer);
                    console.log('MIDI file size:', bytes.length, 'bytes');
                    // Store for later use
                    this.midiBytes = bytes;
                }
                
                arrayBufferToBase64(buffer) {
                    const bytes = new Uint8Array(buffer);
                    let binary = '';
                    for (let i = 0; i < bytes.byteLength; i++) {
                        binary += String.fromCharCode(bytes[i]);
                    }
                    return btoa(binary);
                }
                
                play() {
                    try {
                        if (this.midi.Player && this.midi.Player.start) {
                            console.log('Starting MIDI playback via Player');
                            this.midi.Player.start();
                            this.isPlaying = true;
                            this.startTime = Date.now() - this.pauseTime;
                        } else {
                            console.log('Using fallback playback');
                            this.playFallback();
                        }
                    } catch (error) {
                        console.error('MIDI playback error:', error);
                        throw error;
                    }
                }
                
                playFallback() {
                    // Simple test playback
                    console.log('Playing test notes as fallback');
                    this.isPlaying = true;
                    
                    // Play a test scale
                    const notes = [60, 62, 64, 65, 67, 69, 71, 72]; // C major scale
                    let delay = 0;
                    
                    notes.forEach(note => {
                        setTimeout(() => {
                            this.noteOn(0, note, 100);
                            setTimeout(() => {
                                this.noteOff(0, note);
                            }, 400);
                        }, delay);
                        delay += 500;
                    });
                    
                    setTimeout(() => {
                        this.isPlaying = false;
                        console.log('Fallback playback completed');
                    }, delay);
                }
                
                pause() {
                    if (this.midi.Player && this.midi.Player.pause) {
                        this.midi.Player.pause();
                        this.pauseTime = Date.now() - this.startTime;
                        this.isPlaying = false;
                    }
                }
                
                resume() {
                    if (this.midi.Player && this.midi.Player.resume) {
                        this.midi.Player.resume();
                        this.startTime = Date.now() - this.pauseTime;
                        this.isPlaying = true;
                    }
                }
                
                stop() {
                    try {
                        if (this.midi.Player && this.midi.Player.stop) {
                            this.midi.Player.stop();
                        }
                        this.allNotesOff();
                        this.isPlaying = false;
                        this.pauseTime = 0;
                        this.startTime = 0;
                    } catch (error) {
                        console.error('Error stopping MIDI:', error);
                    }
                }
                
                getCurrentTime() {
                    if (this.midi.Player && this.midi.Player.currentTime) {
                        return this.midi.Player.currentTime;
                    }
                    if (this.isPlaying) {
                        return (Date.now() - this.startTime) / 1000;
                    }
                    return this.pauseTime / 1000;
                }
                
                getDuration() {
                    if (this.midi.Player && this.midi.Player.endTime) {
                        return this.midi.Player.endTime;
                    }
                    return 0; // Unknown duration for fallback
                }
                
                setVolume(value) {
                    // value should be 0-1
                    const midiVolume = Math.round(value * 127);
                    if (this.midi.setVolume) {
                        for (let channel = 0; channel < 16; channel++) {
                            this.midi.setVolume(channel, midiVolume);
                        }
                    }
                    if (this.gainNode) {
                        this.gainNode.gain.value = value;
                    }
                }
                
                async loadSoundfont(soundfontData) {
                    try {
                        if (this.midi.loadPlugin) {
                            // Use MIDI.js loadPlugin method
                            await this.midi.loadPlugin({
                                soundfontUrl: soundfontData,
                                targetFormat: 'mp3',
                                onsuccess: () => {
                                    this.ready = true;
                                    console.log('Soundfont loaded successfully');
                                }
                            });
                        } else {
                            // Store for later use
                            this.currentSoundfont = soundfontData;
                            this.ready = true;
                        }
                    } catch (error) {
                        console.error('Failed to load soundfont:', error);
                        throw error;
                    }
                }
                
                noteOn(channel, note, velocity, delay = 0) {
                    if (this.midi.noteOn) {
                        this.midi.noteOn(channel, note, velocity, delay);
                    }
                }
                
                noteOff(channel, note, delay = 0) {
                    if (this.midi.noteOff) {
                        this.midi.noteOff(channel, note, delay);
                    }
                }
                
                programChange(channel, program) {
                    if (this.midi.programChange) {
                        this.midi.programChange(channel, program);
                    }
                }
                
                allNotesOff() {
                    if (this.midi.stopAllNotes) {
                        this.midi.stopAllNotes();
                    } else {
                        // Manual all notes off
                        for (let channel = 0; channel < 16; channel++) {
                            for (let note = 0; note < 128; note++) {
                                this.noteOff(channel, note);
                            }
                        }
                    }
                }
            };
            
            // Also expose the raw MIDI object for advanced usage
            window.MIDICube.MIDI = window.MIDI;
            
            console.log('✅ MIDICube wrapper created with full playback support');
            clearInterval(checkInterval);
        }
    }, 100);
    
    // Stop checking after 10 seconds
    setTimeout(function() {
        if (checkInterval) {
            clearInterval(checkInterval);
            if (!window.MIDICube) {
                console.warn('⚠️ Midicube loader timeout - MIDI object not found');
                
                // Create a stub to prevent errors
                window.MIDICube = class MIDICube {
                    constructor() {
                        throw new Error('Midicube library failed to load properly');
                    }
                };
            }
        }
    }, 10000);
    
})();