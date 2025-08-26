// MidiParser - Handles MIDI file parsing
class MidiParser {
    constructor() {
        this.debug = false;
    }
    
    parse(data) {
        try {
            const view = new DataView(data.buffer);
            let pos = 0;
            
            // Read header
            const header = this.readHeader(view, pos);
            pos += header.length + 8;
            
            const events = [];
            let globalTempo = 500000; // Default tempo (120 BPM)
            
            // Read tracks
            for (let track = 0; track < header.trackCount; track++) {
                if (pos >= data.length - 8) break;
                
                const trackHeader = this.readTrackHeader(view, pos);
                pos += 8;
                
                if (trackHeader.type !== 'MTrk') {
                    pos += trackHeader.length;
                    continue;
                }
                
                const trackEvents = this.parseTrack(view, pos, trackHeader.length, header.ticksPerQuarter);
                
                // Extract tempo from first track (usually)
                if (track === 0) {
                    const tempoEvent = trackEvents.find(e => e.type === 'tempo');
                    if (tempoEvent) {
                        globalTempo = tempoEvent.value;
                    }
                }
                
                events.push(...trackEvents);
                pos += trackHeader.length;
            }
            
            // Sort events by time
            events.sort((a, b) => a.time - b.time);
            
            // Calculate duration
            const duration = this.calculateDuration(events, globalTempo, header.ticksPerQuarter);
            
            return {
                events: events,
                duration: duration,
                ticksPerQuarter: header.ticksPerQuarter,
                tempo: globalTempo,
                format: header.format,
                trackCount: header.trackCount
            };
            
        } catch (error) {
            console.error('MIDI parsing error:', error);
            
            // Return minimal valid structure
            return {
                events: [],
                duration: 120,
                ticksPerQuarter: 480,
                tempo: 500000,
                format: 0,
                trackCount: 1
            };
        }
    }
    
    readHeader(view, pos) {
        // Check MThd header
        const headerID = view.getUint32(pos);
        if (headerID !== 0x4D546864) { // 'MThd'
            throw new Error('Invalid MIDI file: Missing MThd header');
        }
        
        const headerLength = view.getUint32(pos + 4);
        const format = view.getUint16(pos + 8);
        const trackCount = view.getUint16(pos + 10);
        const ticksPerQuarter = view.getUint16(pos + 12);
        
        if (this.debug) {
            console.log('MIDI Header:', {
                format,
                trackCount,
                ticksPerQuarter,
                headerLength
            });
        }
        
        return {
            format,
            trackCount,
            ticksPerQuarter,
            length: headerLength
        };
    }
    
    readTrackHeader(view, pos) {
        const typeBytes = new Uint8Array(view.buffer, pos, 4);
        const type = String.fromCharCode(...typeBytes);
        const length = view.getUint32(pos + 4);
        
        return { type, length };
    }
    
    parseTrack(view, start, length, ticksPerQuarter) {
        const events = [];
        let pos = start;
        let time = 0;
        let runningStatus = 0;
        const end = start + length;
        
        while (pos < end - 1) {
            try {
                // Read delta time
                const deltaTime = this.readVariableLength(view, pos);
                pos += deltaTime.bytesRead;
                time += deltaTime.value;
                
                if (pos >= end) break;
                
                let eventByte = view.getUint8(pos++);
                let isRunningStatus = false;
                
                // Handle running status
                if (eventByte < 0x80) {
                    if (runningStatus === 0) {
                        console.warn('Invalid running status');
                        break;
                    }
                    pos--; // Back up, we'll use running status
                    eventByte = runningStatus;
                    isRunningStatus = true;
                }
                
                if (eventByte >= 0x80 && eventByte <= 0xEF) {
                    runningStatus = eventByte;
                }
                
                // Parse event
                const event = this.parseEvent(view, pos, eventByte, time, ticksPerQuarter);
                if (event) {
                    events.push(event);
                    pos += event.bytesConsumed || 0;
                }
                
                if (eventByte === 0xFF) {
                    // Meta event - reset running status
                    runningStatus = 0;
                }
                
            } catch (error) {
                if (this.debug) {
                    console.warn('Error parsing track event:', error);
                }
                break;
            }
        }
        
        return events;
    }
    
    parseEvent(view, pos, eventByte, ticks, ticksPerQuarter) {
        const command = eventByte & 0xF0;
        const channel = eventByte & 0x0F;
        
        // Convert ticks to seconds (approximate)
        const time = (ticks * 500000) / (ticksPerQuarter * 1000000); // Assuming 120 BPM
        
        try {
            switch (command) {
                case 0x80: // Note Off
                    if (pos + 1 < view.byteLength) {
                        const note = view.getUint8(pos);
                        const velocity = view.getUint8(pos + 1);
                        return {
                            time: time,
                            type: 'noteOff',
                            channel: channel,
                            note: note,
                            velocity: velocity,
                            bytesConsumed: 2
                        };
                    }
                    break;
                    
                case 0x90: // Note On
                    if (pos + 1 < view.byteLength) {
                        const note = view.getUint8(pos);
                        const velocity = view.getUint8(pos + 1);
                        return {
                            time: time,
                            type: velocity > 0 ? 'noteOn' : 'noteOff',
                            channel: channel,
                            note: note,
                            velocity: velocity,
                            bytesConsumed: 2
                        };
                    }
                    break;
                    
                case 0xA0: // Polyphonic Pressure
                    if (pos + 1 < view.byteLength) {
                        return {
                            time: time,
                            type: 'polyPressure',
                            channel: channel,
                            note: view.getUint8(pos),
                            pressure: view.getUint8(pos + 1),
                            bytesConsumed: 2
                        };
                    }
                    break;
                    
                case 0xB0: // Control Change
                    if (pos + 1 < view.byteLength) {
                        const controller = view.getUint8(pos);
                        const value = view.getUint8(pos + 1);
                        return {
                            time: time,
                            type: 'controlChange',
                            channel: channel,
                            controller: controller,
                            value: value,
                            bytesConsumed: 2
                        };
                    }
                    break;
                    
                case 0xC0: // Program Change
                    if (pos < view.byteLength) {
                        return {
                            time: time,
                            type: 'programChange',
                            channel: channel,
                            program: view.getUint8(pos),
                            bytesConsumed: 1
                        };
                    }
                    break;
                    
                case 0xD0: // Channel Pressure
                    if (pos < view.byteLength) {
                        return {
                            time: time,
                            type: 'channelPressure',
                            channel: channel,
                            pressure: view.getUint8(pos),
                            bytesConsumed: 1
                        };
                    }
                    break;
                    
                case 0xE0: // Pitch Bend
                    if (pos + 1 < view.byteLength) {
                        const lsb = view.getUint8(pos);
                        const msb = view.getUint8(pos + 1);
                        const value = (msb << 7) | lsb - 8192; // Convert to signed 14-bit
                        return {
                            time: time,
                            type: 'pitchBend',
                            channel: channel,
                            value: value,
                            bytesConsumed: 2
                        };
                    }
                    break;
                    
                case 0xF0: // System messages
                    return this.parseSystemEvent(view, pos, eventByte, time);
            }
        } catch (error) {
            if (this.debug) {
                console.warn('Error parsing MIDI event:', error);
            }
        }
        
        return null;
    }
    
    parseSystemEvent(view, pos, eventByte, time) {
        if (eventByte === 0xFF) {
            // Meta event
            if (pos >= view.byteLength) return null;
            
            const metaType = view.getUint8(pos++);
            const length = this.readVariableLength(view, pos);
            pos += length.bytesRead;
            
            let bytesConsumed = 1 + length.bytesRead + length.value;
            
            switch (metaType) {
                case 0x51: // Set Tempo
                    if (length.value === 3 && pos + 2 < view.byteLength) {
                        const tempo = (view.getUint8(pos) << 16) | 
                                     (view.getUint8(pos + 1) << 8) | 
                                     view.getUint8(pos + 2);
                        return {
                            time: time,
                            type: 'tempo',
                            value: tempo,
                            bytesConsumed: bytesConsumed
                        };
                    }
                    break;
                    
                case 0x58: // Time Signature
                    if (length.value === 4 && pos + 3 < view.byteLength) {
                        return {
                            time: time,
                            type: 'timeSignature',
                            numerator: view.getUint8(pos),
                            denominator: Math.pow(2, view.getUint8(pos + 1)),
                            clocksPerClick: view.getUint8(pos + 2),
                            notatedThirtySecondNotes: view.getUint8(pos + 3),
                            bytesConsumed: bytesConsumed
                        };
                    }
                    break;
                    
                case 0x59: // Key Signature
                    if (length.value === 2 && pos + 1 < view.byteLength) {
                        return {
                            time: time,
                            type: 'keySignature',
                            sharpsFlats: view.getInt8(pos), // Signed
                            majorMinor: view.getUint8(pos + 1),
                            bytesConsumed: bytesConsumed
                        };
                    }
                    break;
                    
                case 0x2F: // End of Track
                    return {
                        time: time,
                        type: 'endOfTrack',
                        bytesConsumed: bytesConsumed
                    };
                    
                default:
                    // Skip unknown meta events
                    return {
                        time: time,
                        type: 'unknown',
                        metaType: metaType,
                        bytesConsumed: bytesConsumed
                    };
            }
        } else if (eventByte === 0xF0) {
            // System Exclusive
            const length = this.readVariableLength(view, pos);
            return {
                time: time,
                type: 'sysex',
                bytesConsumed: length.bytesRead + length.value
            };
        }
        
        return null;
    }
    
    readVariableLength(view, pos) {
        let value = 0;
        let bytesRead = 0;
        let byte;
        
        do {
            if (pos + bytesRead >= view.byteLength) {
                break;
            }
            
            byte = view.getUint8(pos + bytesRead);
            value = (value << 7) | (byte & 0x7F);
            bytesRead++;
            
            if (bytesRead > 4) {
                // Prevent infinite loops
                break;
            }
        } while (byte & 0x80);
        
        return { value, bytesRead };
    }
    
    calculateDuration(events, tempo, ticksPerQuarter) {
        if (events.length === 0) {
            return 120; // Default 2 minutes
        }
        
        // Find the last event with substantial timing
        let lastTime = 0;
        let lastNoteOff = 0;
        
        for (const event of events) {
            if (event.time > lastTime) {
                lastTime = event.time;
            }
            
            if (event.type === 'noteOff' && event.time > lastNoteOff) {
                lastNoteOff = event.time;
            }
        }
        
        // Use the later of last event time or last note off, plus a buffer
        const calculatedDuration = Math.max(lastTime, lastNoteOff) + 2;
        
        // Ensure minimum duration
        return Math.max(calculatedDuration, 10);
    }
    
    // Utility method to get MIDI event statistics
    getStatistics(midiData) {
        const stats = {
            totalEvents: midiData.events.length,
            noteEvents: 0,
            controlEvents: 0,
            programChanges: 0,
            channels: new Set(),
            duration: midiData.duration,
            tempo: midiData.tempo,
            ticksPerQuarter: midiData.ticksPerQuarter
        };
        
        midiData.events.forEach(event => {
            switch (event.type) {
                case 'noteOn':
                case 'noteOff':
                    stats.noteEvents++;
                    stats.channels.add(event.channel);
                    break;
                case 'controlChange':
                    stats.controlEvents++;
                    stats.channels.add(event.channel);
                    break;
                case 'programChange':
                    stats.programChanges++;
                    stats.channels.add(event.channel);
                    break;
            }
        });
        
        stats.channels = Array.from(stats.channels).sort();
        return stats;
    }
    
    // Enable debug mode
    enableDebug() {
        this.debug = true;
    }
    
    // Disable debug mode
    disableDebug() {
        this.debug = false;
    }
}
